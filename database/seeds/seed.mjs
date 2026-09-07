#!/usr/bin/env node
// Owner: Charan (Backend Core / Platform Engineer)
//
// Produces the demo-ready state the Section 3 "Independent demo" calls for:
// three operator accounts, one mission and three sectors — with zero other
// services running. Idempotent, so re-running it before a rehearsal resets the
// demo without dropping the database.
//
// Plain ESM JavaScript rather than TypeScript so it runs with a bare
// `node database/seeds/seed.mjs` on any machine, no build step and no loader
// flag. `pg` is resolved from apps/api/node_modules.
//
// Geometry mirrors apps/simulator/src/sectors.ts exactly, so the simulator's
// drones fly inside the sectors this seed creates, and the fixtures in
// packages/contracts/mocks/ describe the same rows.

import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * `pg` lives in apps/api/node_modules in a checkout and beside the script in
 * the Docker image, so try the ordinary upward resolution first and fall back
 * to the workspace path. Called from main() only, so importing this module for
 * its hashPassword export never needs pg installed.
 */
function loadPgClient() {
  const bases = [
    import.meta.url,
    pathToFileURL(path.join(__dirname, '../../apps/api/package.json')).href,
  ];
  for (const base of bases) {
    try {
      return createRequire(base)('pg').Client;
    } catch {
      // try the next base
    }
  }
  throw new Error('Cannot resolve "pg" — run `npm install` in apps/api first.');
}

const scrypt = promisify(scryptCallback);

/**
 * Must stay byte-compatible with apps/api/src/auth/password.ts —
 * apps/api/src/auth/seed-password.spec.ts fails the build if it ever drifts.
 */
export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

/** Every seeded account shares this password. Demo credentials, never production ones. */
export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'resqnet-demo';

const USERS = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'admin@resqnet.demo',
    full_name: 'NDRF Command Admin',
    role: 'admin',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    email: 'operator@resqnet.demo',
    full_name: 'Sector Operator',
    role: 'operator',
  },
  {
    id: '00000000-0000-4000-8000-000000000003',
    email: 'viewer@resqnet.demo',
    full_name: 'District Authority Viewer',
    role: 'viewer',
  },
];

const MISSION = {
  id: '00000000-0000-4000-8000-000000000101',
  mission_id: 'MISSION-DEMO-1',
  name: 'Yamuna Flood Plain — Demo Sweep',
  // Seeded as `created`, not `active`: the demo's first beat is the operator
  // starting the mission, which is what publishes mission.started to Chirag's
  // gateway. A pre-started mission would skip that step.
  status: 'created',
  zone_polygon: {
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
  },
  sector_count: 3,
  created_by: '00000000-0000-4000-8000-000000000001',
};

const box = (lonMin, latMin, lonMax, latMax) => ({
  type: 'Polygon',
  coordinates: [
    [
      [lonMin, latMin],
      [lonMax, latMin],
      [lonMax, latMax],
      [lonMin, latMax],
      [lonMin, latMin],
    ],
  ],
});

const SECTORS = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    sector_id: 'SECTOR-A',
    polygon: box(77.2, 28.61, 77.21, 28.615),
    assigned_drone_id: 'DRONE-01',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    sector_id: 'SECTOR-B',
    polygon: box(77.2, 28.615, 77.21, 28.62),
    assigned_drone_id: 'DRONE-02',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    sector_id: 'SECTOR-C',
    polygon: box(77.21, 28.61, 77.22, 28.62),
    assigned_drone_id: 'DRONE-03',
  },
];

export async function seed(client) {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const user of USERS) {
    await client.query(
      `INSERT INTO users (id, email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE
         SET email = EXCLUDED.email,
             password_hash = EXCLUDED.password_hash,
             full_name = EXCLUDED.full_name,
             role = EXCLUDED.role,
             updated_at = now()`,
      [user.id, user.email, passwordHash, user.full_name, user.role],
    );
  }

  await client.query(
    `INSERT INTO missions (id, mission_id, name, status, zone_polygon, sector_count, created_by)
     VALUES ($1, $2, $3, $4, ST_SetSRID(ST_GeomFromGeoJSON($5), 4326), $6, $7)
     ON CONFLICT (mission_id) DO UPDATE
       SET name = EXCLUDED.name,
           status = EXCLUDED.status,
           zone_polygon = EXCLUDED.zone_polygon,
           sector_count = EXCLUDED.sector_count,
           started_at = NULL,
           completed_at = NULL,
           updated_at = now()`,
    [
      MISSION.id,
      MISSION.mission_id,
      MISSION.name,
      MISSION.status,
      JSON.stringify(MISSION.zone_polygon),
      MISSION.sector_count,
      MISSION.created_by,
    ],
  );

  for (const sector of SECTORS) {
    await client.query(
      `INSERT INTO sectors (id, mission_id, sector_id, polygon, assigned_drone_id)
       VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326), $5)
       ON CONFLICT (mission_id, sector_id) DO UPDATE
         SET polygon = EXCLUDED.polygon,
             assigned_drone_id = EXCLUDED.assigned_drone_id`,
      [
        sector.id,
        MISSION.mission_id,
        sector.sector_id,
        JSON.stringify(sector.polygon),
        sector.assigned_drone_id,
      ],
    );
  }

  return { users: USERS.length, missions: 1, sectors: SECTORS.length };
}

async function main() {
  const Client = loadPgClient();
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? 'resqnet',
    password: process.env.DB_PASSWORD ?? 'resqnet',
    database: process.env.DB_NAME ?? 'resqnet',
  });

  await client.connect();
  try {
    const counts = await seed(client);
    console.log(
      `Seeded ${counts.users} users, ${counts.missions} mission (${MISSION.mission_id}) ` +
        `and ${counts.sectors} sectors.`,
    );
    console.log(`Login with operator@resqnet.demo / ${DEMO_PASSWORD}`);
  } finally {
    await client.end();
  }
}

// Only run when invoked directly — the spec imports hashPassword from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
