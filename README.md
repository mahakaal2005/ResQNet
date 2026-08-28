# ResQNet — Chirag's Track (Backend Realtime + Simulator)

Week 1 deliverable per the Team Role Distribution plan. This covers everything
in `apps/realtime/`, `apps/simulator/`, and the shared `packages/contracts/telemetry.schema.json`.

## What's here

```
packages/contracts/
  telemetry.schema.json   ← FROZEN. Owner: Chirag. Co-sign: Atul.
  README.md                ← event ownership table (drone.*, network.*, sync.*, mission.*)

apps/simulator/
  src/sectors.ts            3 demo sectors + synthetic ground-truth survivor coords
  src/droneAgent.ts         deterministic lawnmower-path telemetry generator
  src/generateFixtures.ts   writes sample_telemetry.json + sample_frames/ + ground_truth.json
  src/index.ts              live mode: streams 3 drones to the gateway at 1Hz
  sample_telemetry.json     120 pre-generated packets (3 drones × 40 ticks) — Faiqua/Atul's Week 1 fixture
  ground_truth.json         known lat/lon per sector, for Atul's geolocation error scoring
  sample_frames/            15 placeholder frame files + manifest.json

apps/realtime/
  src/gateway/server.ts           Express health check + Socket.IO /realtime namespace
  src/gateway/telemetryValidator.ts   ajv validation against the frozen schema
  src/drone-state/stateMachine.ts     connected / lost / reconnected FSM
  src/drone-state/missionState.ts     mocked mission.started until Charan's API is live
  tests/                          11 passing unit tests
```

## Setup

```bash
npm install --workspaces --include-workspace-root
```

## Run the independent demo (no other services required)

Terminal 1 — gateway:
```bash
npm run dev:realtime
# -> gateway listening on :4000
```

Terminal 2 — simulator:
```bash
npm run dev:simulator
# -> connects, gets mission.started (mocked), streams 3 drones at 1Hz
```

Terminal 3 — watch it live with a raw client, or:
```bash
curl http://localhost:4000/realtime/health
```

## Regenerate fixtures

```bash
npm run fixtures
# writes apps/simulator/sample_telemetry.json, ground_truth.json, sample_frames/
```

## Tests

```bash
cd apps/realtime && npm test
```
11/11 passing: schema validation (accepts valid packets, rejects missing
fields, out-of-range values, unknown fields, malformed IDs) and the drone
state machine (connected → lost → reconnected transitions, multi-drone
isolation).

## Definition of Done — status

- [x] Telemetry contract frozen and documented in `packages/contracts/`
- [x] Realtime gateway skeleton running, broadcasting `drone.telemetry` / `drone.status`
- [x] Simulator produces 2–3 concurrent drones on the frozen schema
- [x] `sample_telemetry.json` + `sample_frames/` delivered — Faiqua and Atul can start now
- [x] Offline/lost detection state machine, unit-tested
- [x] Independent demo verified: gateway + simulator alone, raw client sees live broadcasts, zero backend-core/AI/dashboard running
- [ ] Consume real `mission.started` from Charan (Week 2 — currently mocked per Section 23)
- [ ] `network.offline` → local edge buffer → `sync.completed` full replay (Week 3 scope)
- [ ] 2nd/3rd drone hardening pass (Week 3)

## Notes for downstream owners

- **Faiqua / Atul:** `apps/simulator/sample_telemetry.json` and `sample_frames/`
  are your Week 1 fixtures — don't wait on the live simulator. `ground_truth.json`
  has the known coordinates Atul's geolocation error should be scored against.
- **Ayush:** subscribe to `drone.telemetry` / `drone.status` on the `/realtime`
  namespace once you're ready to swap off `mockApi/`; payload shapes are frozen
  in `packages/contracts/README.md`.
- **Any change to `telemetry.schema.json`** needs my sign-off + Atul's — see
  Section 16 of the plan.
