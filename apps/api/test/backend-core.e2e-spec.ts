import { INestApplication, ValidationPipe } from '@nestjs/common';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client } from 'pg';
import type { SuperTestStatic } from 'supertest';
import { GenericContainer, Wait, type StartedTestContainer } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditModule } from '../src/audit/audit.module.js';
import { AuditLog } from '../src/audit/entities/audit-log.entity.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { User } from '../src/auth/entities/user.entity.js';
import { Mission } from '../src/missions/entities/mission.entity.js';
import { MissionsModule } from '../src/missions/missions.module.js';
import { OperatorsModule } from '../src/operators/operators.module.js';
import { Sector } from '../src/sectors/entities/sector.entity.js';
import { SectorsModule } from '../src/sectors/sectors.module.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// 0002 only. The core schema declares no foreign key into Rudra's tables, so
// this test doubles as proof of the Section 3 claim that the core API runs
// with 0001 absent entirely.
const MIGRATION = path.join(REPO_ROOT, 'database/migrations/0002_charan_core_tables.sql');
const SEED = pathToFileURL(path.join(REPO_ROOT, 'database/seeds/seed.mjs')).href;

const ZONE = {
  type: 'Polygon',
  coordinates: [
    [
      [77.2, 28.61],
      [77.22, 28.61],
      [77.22, 28.62],
      [77.2, 28.62],
      [77.2, 28.61],
    ],
  ],
};

/**
 * The Section 3 integration test: login -> create mission -> assign sectors ->
 * an audit log entry written for each action, against a real Postgres+PostGIS
 * container with zero other services running.
 */
describe('Backend core (auth -> missions -> sectors -> audit)', () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let events: EventEmitter2;
  let request: SuperTestStatic;

  let operatorToken: string;
  let viewerToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    container = await new GenericContainer('postgis/postgis:16-3.4')
      .withEnvironment({
        POSTGRES_USER: 'resqnet',
        POSTGRES_PASSWORD: 'resqnet',
        POSTGRES_DB: 'resqnet',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    const host = container.getHost();
    const port = container.getMappedPort(5432);

    const client = new Client({
      host,
      port,
      user: 'resqnet',
      password: 'resqnet',
      database: 'resqnet',
    });
    await client.connect();
    await client.query(readFileSync(MIGRATION, 'utf-8'));
    // Runs the real seed script, so the demo bootstrap is covered by CI too.
    const { seed } = await import(SEED);
    await seed(client);
    await client.end();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host,
          port,
          username: 'resqnet',
          password: 'resqnet',
          database: 'resqnet',
          entities: [User, Mission, Sector, AuditLog],
          synchronize: false,
        }),
        EventEmitterModule.forRoot(),
        AuthModule,
        MissionsModule,
        SectorsModule,
        OperatorsModule,
        AuditModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    events = app.get(EventEmitter2);
    request = (await import('supertest')).default;
  }, 180_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('logs a seeded operator in and rejects a bad password', async () => {
    const http = app.getHttpServer();

    const ok = await request(http)
      .post('/auth/login')
      .send({ email: 'operator@resqnet.demo', password: 'resqnet-demo' })
      .expect(200);

    expect(ok.body.token_type).toBe('Bearer');
    expect(ok.body.user).toMatchObject({ email: 'operator@resqnet.demo', role: 'operator' });
    operatorToken = ok.body.access_token;
    refreshToken = ok.body.refresh_token;

    await request(http)
      .post('/auth/login')
      .send({ email: 'operator@resqnet.demo', password: 'wrong' })
      .expect(401);

    const viewer = await request(http)
      .post('/auth/login')
      .send({ email: 'viewer@resqnet.demo', password: 'resqnet-demo' })
      .expect(200);
    viewerToken = viewer.body.access_token;
  });

  it('trades a refresh token for a new access token', async () => {
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);

    expect(refreshed.body.access_token).toBeTruthy();

    // An access token is not a refresh token.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: operatorToken })
      .expect(401);
  });

  it('returns the caller and their permissions from GET /operators/me', async () => {
    const me = await request(app.getHttpServer())
      .get('/operators/me')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);

    expect(me.body).toMatchObject({ email: 'operator@resqnet.demo', role: 'operator' });
    expect(me.body.permissions).toContain('mission:create');
    expect(me.body).not.toHaveProperty('password_hash');
  });

  it('refuses unauthenticated and under-privileged callers', async () => {
    const http = app.getHttpServer();

    await request(http).get('/missions').expect(401);
    await request(http).get('/missions').set('Authorization', 'Bearer nonsense').expect(401);

    // A viewer may read but never start a mission (PRD Section 6).
    await request(http).get('/missions').set('Authorization', `Bearer ${viewerToken}`).expect(200);
    await request(http)
      .post('/missions')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Viewer attempt', zone_polygon: ZONE, sector_count: 3 })
      .expect(403);
  });

  it('creates a mission and splits its zone into the requested sectors', async () => {
    const http = app.getHttpServer();

    const created = await request(http)
      .post('/missions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        mission_id: 'MISSION-E2E-1',
        name: 'Integration Sweep',
        zone_polygon: ZONE,
        sector_count: 3,
      })
      .expect(201);

    expect(created.body.status).toBe('created');
    expect(created.body.sectors.map((s: Sector) => s.sectorId)).toEqual([
      'SECTOR-A',
      'SECTOR-B',
      'SECTOR-C',
    ]);

    // Both identifiers resolve to the same mission.
    const byExternalId = await request(http)
      .get('/missions/MISSION-E2E-1')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    const byUuid = await request(http)
      .get(`/missions/${created.body.id}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    expect(byUuid.body.missionId).toBe(byExternalId.body.missionId);

    await request(http)
      .get('/missions/MISSION-DOES-NOT-EXIST')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(404);
  });

  it('rejects a malformed zone and an out-of-range sector count', async () => {
    const http = app.getHttpServer();

    // Unclosed exterior ring.
    await request(http)
      .post('/missions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        name: 'Bad zone',
        zone_polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [77.2, 28.61],
              [77.22, 28.61],
              [77.22, 28.62],
              [77.2, 28.615],
            ],
          ],
        },
        sector_count: 2,
      })
      .expect(400);

    // 27 exceeds the SECTOR-[A-Z] ceiling the telemetry contract imposes.
    await request(http)
      .post('/missions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ name: 'Too many', zone_polygon: ZONE, sector_count: 27 })
      .expect(400);

    // Neither attempt may leave a mission row behind.
    const missions = await request(http)
      .get('/missions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    expect(missions.body.map((m: Mission) => m.name)).not.toContain('Bad zone');
  });

  it('pins an explicit sector polygon and assigns a drone to it', async () => {
    const http = app.getHttpServer();

    const pinned = await request(http)
      .post('/sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        mission_id: 'MISSION-E2E-1',
        sector_id: 'SECTOR-A',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [77.2, 28.61],
              [77.21, 28.61],
              [77.21, 28.615],
              [77.2, 28.615],
              [77.2, 28.61],
            ],
          ],
        },
        assigned_drone_id: 'DRONE-01',
      })
      .expect(201);

    expect(pinned.body.assignedDroneId).toBe('DRONE-01');

    // Upsert, not duplicate: still exactly three sectors.
    const sectors = await request(http)
      .get('/missions/MISSION-E2E-1/sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    expect(sectors.body).toHaveLength(3);
    expect(sectors.body[0].assignedDroneId).toBe('DRONE-01');

    // Outside the mission zone.
    await request(http)
      .post('/sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        mission_id: 'MISSION-E2E-1',
        sector_id: 'SECTOR-D',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0],
            ],
          ],
        },
      })
      .expect(400);

    // A sector id the telemetry contract could never carry.
    await request(http)
      .post('/sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ mission_id: 'MISSION-E2E-1', sector_id: 'SECTOR-AA', polygon: ZONE })
      .expect(400);

    // A label the zone split never claimed: an insert, not an upsert, so this
    // is the path that audits as `sector.created` rather than `sector.updated`.
    await request(http)
      .post('/sectors')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        mission_id: 'MISSION-E2E-1',
        sector_id: 'SECTOR-D',
        polygon: {
          type: 'Polygon',
          coordinates: [
            [
              [77.205, 28.612],
              [77.215, 28.612],
              [77.215, 28.618],
              [77.205, 28.618],
              [77.205, 28.612],
            ],
          ],
        },
      })
      .expect(201);
  });

  it('drives the mission state machine and publishes the Section 10.6 events', async () => {
    const http = app.getHttpServer();

    const published: string[] = [];
    for (const name of ['mission.started', 'mission.paused', 'mission.completed']) {
      events.on(name, () => published.push(name));
    }

    const started = await request(http)
      .patch('/missions/MISSION-E2E-1/status')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'active' })
      .expect(200);
    expect(started.body.startedAt).toBeTruthy();

    // Invalid: active -> created.
    await request(http)
      .patch('/missions/MISSION-E2E-1/status')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'created' })
      .expect(400);

    for (const status of ['paused', 'active', 'completed']) {
      await request(http)
        .patch('/missions/MISSION-E2E-1/status')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ status })
        .expect(200);
    }

    // completed is terminal.
    await request(http)
      .patch('/missions/MISSION-E2E-1/status')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'active' })
      .expect(400);

    expect(published).toEqual([
      'mission.started',
      'mission.paused',
      'mission.started',
      'mission.completed',
    ]);
  });

  it('writes an audit entry for every operator action', async () => {
    const http = app.getHttpServer();

    const scoped = await request(http)
      .get('/audit-logs')
      .query({ mission_id: 'MISSION-E2E-1' })
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);

    const actions = scoped.body.map((entry: AuditLog) => entry.action);
    expect(actions).toContain('mission.created');
    expect(actions).toContain('mission.started');
    expect(actions).toContain('mission.paused');
    expect(actions).toContain('mission.completed');
    // The "assign sectors" link in the Section 3 chain: the zone split, an
    // operator refining a generated sector, and an operator adding a new one.
    expect(actions).toContain('sector.assigned');
    expect(actions).toContain('sector.updated');
    expect(actions).toContain('sector.created');
    expect(scoped.body.every((e: AuditLog) => e.missionId === 'MISSION-E2E-1')).toBe(true);
    // Newest first.
    expect(actions[0]).toBe('mission.completed');

    // Chronology, read oldest-first: the mission exists before its sectors do.
    const oldestFirst = [...actions].reverse();
    expect(oldestFirst.indexOf('mission.created')).toBeLessThan(
      oldestFirst.indexOf('sector.assigned'),
    );

    // The split is one action, not one row per sector.
    const assigned = scoped.body.filter((e: AuditLog) => e.action === 'sector.assigned');
    expect(assigned).toHaveLength(1);
    expect(assigned[0].payload).toMatchObject({
      count: 3,
      sector_ids: ['SECTOR-A', 'SECTOR-B', 'SECTOR-C'],
    });

    // Every mission-scoped action names the operator who took it.
    expect(scoped.body.every((e: AuditLog) => e.actorUserId !== null)).toBe(true);

    // Rejected writes leave no trace: SECTOR-AA and the out-of-zone SECTOR-D
    // both 400'd, and only the one accepted SECTOR-D write is recorded.
    const sectorRows = scoped.body.filter((e: AuditLog) => e.entityType === 'sector');
    expect(sectorRows.map((e: AuditLog) => e.entityId).filter(Boolean).sort()).toEqual([
      'SECTOR-A',
      'SECTOR-D',
    ]);

    // Logins are not mission-scoped, so they appear only in the unfiltered log.
    const all = await request(http)
      .get('/audit-logs')
      .set('Authorization', `Bearer ${operatorToken}`)
      .expect(200);
    const allActions = all.body.map((entry: AuditLog) => entry.action);
    expect(allActions).toContain('auth.login');
    expect(allActions).toContain('auth.login_failed');
  });
});
