# Backend core — independent demo

Owner: Charan. Proves auth, mission management, sector assignment and the
audit trail run standalone, with **no other teammate's service required** —
the Section 3 "Independent demo" and Section 28 "own module runs standalone".

Two ways to run it. The **compose walkthrough** is the one to use in front of
judges; the **one-command test** is the one CI runs.

---

## A. Compose walkthrough (the demo)

### Requirement

Docker. No `.env` file, no Node install, no other app running.

### Bring it up

```bash
docker compose up -d db api      # postgis:16-3.4 + the API on :3000
docker compose run --rm seed     # 3 operator accounts, 1 mission, 3 sectors
```

`db` applies `database/migrations/*.sql` in filename order on first boot. The
seed is idempotent, so re-running it is also the **"reset the demo"** command
between rehearsal runs.

Seeded accounts, all with password `resqnet-demo`:

| Email | Role | Can |
|---|---|---|
| `admin@resqnet.demo` | admin | everything |
| `operator@resqnet.demo` | operator | create/run missions and sectors |
| `viewer@resqnet.demo` | viewer | read only — the district-authority account |

### 1. Log in

```bash
TOKEN=$(curl -s localhost:3000/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"operator@resqnet.demo","password":"resqnet-demo"}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')
```

The response carries an access token (15m), a refresh token (7d) and the
caller's identity. Wrong password returns `401` with the same message a
missing account does — an attacker learns nothing either way.

### 2. Who am I, and what may I do

```bash
curl -s localhost:3000/operators/me -H "Authorization: Bearer $TOKEN"
```

Returns the caller plus their **permission list**, not just their role, so the
dashboard can hide controls without hard-coding the RBAC matrix.

### 3. Create a mission — demo step 1, "operator draws disaster zone"

```bash
curl -s localhost:3000/missions \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{
    "name": "Yamuna Flood Plain — Live Sweep",
    "sector_count": 3,
    "zone_polygon": {
      "type": "Polygon",
      "coordinates": [[[77.2,28.61],[77.22,28.61],[77.22,28.62],[77.2,28.62],[77.2,28.61]]]
    }
  }'
```

One call creates the mission **and** splits the zone into `SECTOR-A/B/C` —
demo step 2, "sector assignment". The response includes the generated
`mission_id` (`MISSION-<8 hex>`); everything below uses the seeded
`MISSION-DEMO-1` instead so the commands are copy-pasteable as they stand.

A zone that is not a closed GeoJSON ring, or a `sector_count` above 26 (the
`SECTOR-[A-Z]` ceiling the frozen telemetry contract imposes), is rejected
with `400` and **nothing is written** — no half-created mission.

### 4. Read the sector layout

```bash
curl -s localhost:3000/missions/MISSION-DEMO-1/sectors -H "Authorization: Bearer $TOKEN"
```

`:id` accepts either the surrogate uuid or the external `mission_id`.

### 5. Pin a sector and assign a drone

```bash
curl -s localhost:3000/sectors \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{
    "mission_id": "MISSION-DEMO-1",
    "sector_id": "SECTOR-A",
    "assigned_drone_id": "DRONE-01",
    "polygon": {
      "type": "Polygon",
      "coordinates": [[[77.2,28.61],[77.21,28.61],[77.21,28.615],[77.2,28.615],[77.2,28.61]]]
    }
  }'
```

Upsert, not insert: this **replaces** the generated `SECTOR-A` strip rather
than colliding with it. A polygon outside the mission zone is rejected with
`400`.

### 6. Run the mission state machine

```bash
for S in active paused active completed; do
  curl -s -X PATCH localhost:3000/missions/MISSION-DEMO-1/status \
    -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
    -d "{\"status\":\"$S\"}"
done
```

Each accepted transition publishes the matching Section 10.6 event —
`mission.started`, `mission.paused`, `mission.started`, `mission.completed` —
which is what starts and stops drone motion once Chirag's gateway is attached.
`completed` is terminal: a fifth call returns `400`.

### 7. Read the audit trail

```bash
curl -s "localhost:3000/audit-logs?mission_id=MISSION-DEMO-1" -H "Authorization: Bearer $TOKEN"
```

Newest first. Every action above appears, each naming the operator who took
it: `mission.created`, `sector.assigned`, `sector.created` / `sector.updated`,
`mission.started`, `mission.paused`, `mission.completed`. Logins are not
mission-scoped, so `auth.login` and `auth.login_failed` appear only in the
unfiltered `GET /audit-logs`.

### 8. Show RBAC holding

```bash
VIEWER=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"viewer@resqnet.demo","password":"resqnet-demo"}' \
  | python -c 'import json,sys; print(json.load(sys.stdin)["access_token"])')

curl -s -o /dev/null -w '%{http_code}\n' -X PATCH \
  localhost:3000/missions/MISSION-DEMO-1/status \
  -H "Authorization: Bearer $VIEWER" -H 'content-type: application/json' \
  -d '{"status":"active"}'      # 403
```

The viewer reads everything and changes nothing.

### Tear down

```bash
docker compose down -v
```

### Postman

[`resqnet-core.postman_collection.json`](resqnet-core.postman_collection.json)
is the same eight steps as an importable collection. Import it, run **Login**
once — it stores the token in a collection variable — then run the rest in
order, or use Postman's Collection Runner to run all of them at once.

---

## B. One-command test (what CI runs)

```bash
cd apps/api
npm install
npm run demo:core
```

[`test/backend-core.e2e-spec.ts`](../../apps/api/test/backend-core.e2e-spec.ts)
starts a throwaway `postgis/postgis:16-3.4` container via Testcontainers,
applies **only** `0002_charan_core_tables.sql`, runs the seed against it, and
drives the same login → mission → sectors → state machine → audit chain
through a real NestJS app.

Applying 0002 alone is deliberate: it is the executable proof that the core
schema declares no foreign key into Rudra's tables and boots with 0001 absent
entirely. The container is destroyed at the end of the run.

Run by [`.github/workflows/api-core-tests.yml`](../../.github/workflows/api-core-tests.yml)
on every push touching these paths.
