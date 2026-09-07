# database

`migrations/` — gatekept by Charan. One migration file per PR, sequential
numbering. Charan reviews all of them regardless of which table's owner
authored it (Section 3, Section 11, Section 16).

| File | Owner | Tables |
|---|---|---|
| `0001_rudra_intelligence_tables.sql` | Rudra | detections, geolocations, incidents, incident_events, priority_scores |
| `0002_charan_core_tables.sql` | Charan | users, missions, sectors, audit_logs |

Neither file declares a foreign key into the other's tables, so each half of
`apps/api` boots and demos with the other absent — that is what makes the
Section 3 and Section 5 "independent demo" claims true rather than aspirational.
`apps/api/test/backend-core.e2e-spec.ts` applies **0002 alone** and proves it.

## Applying them

Docker Compose mounts `migrations/` into the Postgres image's
`/docker-entrypoint-initdb.d`, so both files run in filename order the first
time the `db` volume is created:

```bash
docker compose up -d db api
```

Against an existing database, apply one by hand:

```bash
psql "$DATABASE_URL" -f database/migrations/0002_charan_core_tables.sql
```

## Seeding

`seeds/seed.mjs` produces the demo-ready state: three operator accounts, the
`MISSION-DEMO-1` mission and its three sectors, with geometry identical to
`apps/simulator/src/sectors.ts` so the simulator's drones fly inside them.

```bash
docker compose run --rm seed     # or: npm --prefix apps/api run seed
```

It is idempotent (`ON CONFLICT DO UPDATE`), so it doubles as the "reset the
demo" command between rehearsal runs — including resetting the mission back to
`created` so the operator's start-mission beat can be performed again.

Every seeded account uses the password `resqnet-demo` (override with
`SEED_PASSWORD`). The script hashes with the same scrypt encoding
`apps/api/src/auth/password.ts` expects; `seed-password.spec.ts` fails the
build if the two ever drift.

## Table ownership

| Table | Owner |
|---|---|
| users, missions, sectors, audit_logs | Charan |
| drones, drone_telemetry, sync_queue | Chirag |
| detections, geolocations, incidents, incident_events, priority_scores | Rudra |

Rule: no two people modify the same table's migration in the same PR without
the table owner's sign-off.
