import { INestApplication } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog } from '../src/audit/entities/audit-log.entity.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { User } from '../src/auth/entities/user.entity.js';
import { GeolocationIntakeModule } from '../src/geolocation-intake/geolocation-intake.module.js';
import { Detection } from '../src/geolocation-intake/entities/detection.entity.js';
import { Geolocation } from '../src/geolocation-intake/entities/geolocation.entity.js';
import { IncidentEvent } from '../src/incidents/entities/incident-event.entity.js';
import { Incident } from '../src/incidents/entities/incident.entity.js';
import { IncidentsModule } from '../src/incidents/incidents.module.js';
import { PriorityScore } from '../src/priority/entities/priority-score.entity.js';
import { PriorityModule } from '../src/priority/priority.module.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../database/migrations/0001_rudra_intelligence_tables.sql',
);

const VIEWER_ID = '00000000-0000-4000-8000-000000000001';
const OPERATOR_ID = '00000000-0000-4000-8000-000000000002';

const CORE_MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../database/migrations/0002_charan_core_tables.sql',
);

/**
 * This is the integration test called out in the role doc:
 * "feed 2 overlapping detections -> exactly 1 incident created, not 2;
 * feed distress flag -> priority jumps by documented weight." Runs against
 * a real Postgres+PostGIS container, not mocks — this is what proves the
 * dedup/priority chain actually works end to end, independent of anyone
 * else's service.
 */
describe('Intelligence pipeline (Detection -> Geolocation -> Incident -> Priority)', () => {
  let container: StartedTestContainer;
  let app: INestApplication;
  let viewerToken: string;
  let operatorToken: string;

  beforeAll(async () => {
    container = await new GenericContainer('postgis/postgis:16-3.4')
      .withEnvironment({
        POSTGRES_USER: 'resqnet',
        POSTGRES_PASSWORD: 'resqnet',
        POSTGRES_DB: 'resqnet',
      })
      .withExposedPorts(5432)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections', 2),
      )
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
    await client.query(readFileSync(MIGRATION_PATH, 'utf-8'));
    await client.query(readFileSync(CORE_MIGRATION_PATH, 'utf-8'));
    await client.query(
      'INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)',
      [
        VIEWER_ID,
        'viewer@resqnet.test',
        'test-hash',
        'Viewer E2E',
        'viewer',
        OPERATOR_ID,
        'operator@resqnet.test',
        'test-hash',
        'Operator E2E',
        'operator',
      ],
    );
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
          entities: [
            User,
            AuditLog,
            Detection,
            Geolocation,
            Incident,
            IncidentEvent,
            PriorityScore,
          ],
          synchronize: false,
        }),
        EventEmitterModule.forRoot(),
        AuthModule,
        GeolocationIntakeModule,
        IncidentsModule,
        PriorityModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    const jwt = app.get(JwtService);
    viewerToken = await jwt.signAsync({
      sub: VIEWER_ID,
      email: 'viewer@resqnet.test',
      role: 'viewer',
      typ: 'access',
    });
    operatorToken = await jwt.signAsync({
      sub: OPERATOR_ID,
      email: 'operator@resqnet.test',
      role: 'operator',
      typ: 'access',
    });
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('merges two overlapping-sector detections into exactly one incident', async () => {
    const http = app.getHttpServer();
    const { default: request } = await import('supertest');

    await request(http)
      .post('/detections')
      .send({
        detection_id: 'DET-01',
        drone_id: 'DRONE-01',
        sector_id: 'SECTOR-A',
        timestamp: '2026-08-27T10:30:05Z',
        bbox: { x: 120, y: 80, w: 40, h: 90 },
        confidence: 0.87,
        centroid: { x: 140, y: 125 },
      })
      .expect(201);

    await request(http)
      .post('/geolocations')
      .send({
        detection_id: 'DET-01',
        latitude: 28.6142,
        longitude: 77.2093,
        error_m: 4.2,
        method: 'flat_ground_photogrammetric',
      })
      .expect(201);

    await request(http)
      .post('/detections')
      .send({
        detection_id: 'DET-02',
        drone_id: 'DRONE-02',
        sector_id: 'SECTOR-A',
        timestamp: '2026-08-27T10:31:40Z',
        bbox: { x: 118, y: 82, w: 42, h: 88 },
        confidence: 0.91,
        centroid: { x: 139, y: 126 },
      })
      .expect(201);

    const second = await request(http)
      .post('/geolocations')
      .send({
        detection_id: 'DET-02',
        latitude: 28.61423,
        longitude: 77.20934,
        error_m: 3.8,
        method: 'flat_ground_photogrammetric',
      })
      .expect(201);

    const incidentId = second.body.incident.incidentId;
    expect(second.body.incident.survivorCountEstimate).toBe(2);

    await request(http).get('/incidents').expect(401);

    const all = await request(http)
      .get('/incidents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(all.body).toHaveLength(1);
    expect(all.body[0].incidentId).toBe(incidentId);

    return { http, request, incidentId };
  });

  it('rejects a geolocation for a detection that was never ingested', async () => {
    const { default: request } = await import('supertest');
    await request(app.getHttpServer())
      .post('/geolocations')
      .send({
        detection_id: 'DET-DOES-NOT-EXIST',
        latitude: 0,
        longitude: 0,
        error_m: 1,
        method: 'flat_ground_photogrammetric',
      })
      .expect(404);
  });

  it('protects incident reads and updates while preserving priority and state rules', async () => {
    const { default: request } = await import('supertest');
    const http = app.getHttpServer();

    const list = await request(http)
      .get('/incidents')
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    const incidentId = list.body[0].incidentId;

    const before = await request(http)
      .get(`/incidents/${incidentId}/priority-breakdown`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    await request(http)
      .patch(`/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'confirmed' })
      .expect(200);

    await request(http)
      .patch(`/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'dispatched', distress_flag: true })
      .expect(200);

    const after = await request(http)
      .get(`/incidents/${incidentId}/priority-breakdown`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(after.body.distress_flag - before.body.distress_flag).toBe(20);
    expect(after.body.total - before.body.total).toBe(20);

    await request(http)
      .patch(`/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'resolved' })
      .expect(403);

    // snake_case: GET /audit-logs serialises through audit.presenter.ts, which
    // matches docs/contracts/audit-log.md and mock_audit_logs.json.
    let incidentAudit: Array<{ action?: string; actor_user_id?: string }> = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const audit = await request(http)
        .get('/audit-logs')
        .set('Authorization', `Bearer ${operatorToken}`)
        .expect(200);
      incidentAudit = audit.body;
      if (
        incidentAudit.some(
          (entry) =>
            entry.action === 'incident.updated' &&
            entry.actor_user_id === OPERATOR_ID,
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(incidentAudit).toContainEqual(
      expect.objectContaining({
        action: 'incident.updated',
        actor_user_id: OPERATOR_ID,
      }),
    );

    // dispatched -> confirmed is not a valid forward transition
    await request(http)
      .patch(`/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'confirmed' })
      .expect(400);
  });
});
