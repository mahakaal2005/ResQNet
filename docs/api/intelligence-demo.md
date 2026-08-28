# Intelligence module — independent demo

Owner: Rudra. Proves the full pipeline — dedup, transparent priority scoring,
and the incident state machine — runs standalone, with **no other teammate's
service required**.

## Requirement

Docker (used to spin up a throwaway Postgres+PostGIS container automatically
via [Testcontainers](https://node.testcontainers.org/)). Nothing else —
no manual DB setup, no `.env` file, no other app running.

## Run it

```bash
cd apps/api
npm install
npm run demo:intelligence
```

This runs [`test/intelligence.e2e-spec.ts`](../../apps/api/test/intelligence.e2e-spec.ts),
which:

1. Starts a fresh `postgis/postgis:16-3.4` container and applies
   [`database/migrations/0001_rudra_intelligence_tables.sql`](../../database/migrations/0001_rudra_intelligence_tables.sql).
2. Boots your three modules (`geolocation-intake`, `incidents`, `priority`)
   as a real NestJS app against that container.
3. POSTs the two-drone, overlapping-sector fixture
   (`packages/contracts/mocks/mock_detection.json` /
   `mock_geolocation_result.json`) and asserts **exactly one incident** is
   created, not two.
4. Confirms the incident, dispatches it with `distress_flag: true`, and
   asserts the priority score jumps by exactly the documented `+20`
   ([`priority-weights.md`](../contracts/priority-weights.md)).
5. Asserts an invalid status transition (`dispatched → confirmed`) is
   rejected with `400`.
6. Tears the container down — no leftover state.

Container is destroyed automatically at the end of the run (or reaped by
Testcontainers' `ryuk` companion container if the process is killed early).

## Manual/interactive variant

To poke at it by hand instead of running the automated spec:

```bash
docker run -d --name resqnet-demo-db -e POSTGRES_USER=resqnet \
  -e POSTGRES_PASSWORD=resqnet -e POSTGRES_DB=resqnet -p 5434:5432 \
  postgis/postgis:16-3.4

docker exec -i resqnet-demo-db psql -U resqnet -d resqnet \
  < database/migrations/0001_rudra_intelligence_tables.sql

cd apps/api
DB_HOST=localhost DB_PORT=5434 DB_USER=resqnet DB_PASSWORD=resqnet \
  DB_NAME=resqnet NODE_ENV=production PORT=3050 npm run start

# in another shell — POST the fixtures from packages/contracts/mocks/
curl -X POST localhost:3050/detections -H "Content-Type: application/json" \
  -d @packages/contracts/mocks/mock_detection.json   # note: contains an array, split per-object for curl
```

## Known interaction to flag

Wiring `TypeOrmModule.forRoot` into `apps/api/src/app.module.ts` (required so
`npm run start` boots something real) means the Nest CLI's default scaffold
test, `test/app.e2e-spec.ts`, now needs a live DB and fails/times out under
plain `npm run test:e2e` without one. This file is shared root wiring, not
exclusively Rudra's — flagged for Charan when `auth`/`missions` land, since
whoever owns bootstrap will likely want a DB-less health check or a
docker-compose-backed CI step either way.
