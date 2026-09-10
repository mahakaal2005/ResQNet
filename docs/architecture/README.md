# Architecture — the integration plan

Section 25 of the Team Role Distribution plan, written down. Kept current as
contracts evolve.

This page describes how the pieces connect and who owns each seam. It is not a
status report — each track's own README is the authority on how far that track
has got.

## The pipeline

```
                          packages/contracts/telemetry.schema.json
                                          │ (frozen)
                                          ▼
  apps/simulator ─── telemetry ───▶ apps/realtime  ─── drone.telemetry ───┐
    (Chirag)                          (Chirag)          drone.status      │
        │                          Socket.IO :4000      network.*         │
        │                          namespace /realtime  sync.completed    │
        │                                  ▲                              │
        │                                  │ mission.started/paused        │
        │                                  │                              │
        │                       apps/api/src/missions                     │
        │                       MissionRealtimePublisher                  │
        │                              (Charan)                           ▼
        │                                                        apps/dashboard
        ▼                                                            (Ayush)
  frames + telemetry pairs                                              ▲
        │                                                               │
        ▼                                                               │
  apps/ai-service                                                       │
   detection (Faiqua) ── detection ──▶ geolocation (Atul)               │
                                            │                           │
                                   geolocation result                   │
                                            ▼                           │
                              apps/api/src/geolocation-intake           │
                                            │      (Rudra)              │
                                            ▼                           │
                              incidents → dedup → priority              │
                                       (Rudra)                          │
                                            │                           │
                                     incident.* events ─────────────────┘
                                    (relayed by Chirag's gateway)
```

Two deployables carry the REST surface and the socket surface:

| Process | Port | Owners |
|---|---|---|
| `apps/api` (NestJS) | 3000 | Charan (core) + Rudra (intelligence), non-overlapping module folders |
| `apps/realtime` (Express + Socket.IO) | 4000 | Chirag |
| `apps/simulator` | — | Chirag |
| `apps/ai-service` | — | Faiqua (detection), Atul (tracking/geolocation) |
| `apps/dashboard` | 3001 | Ayush |

One Postgres 16 + PostGIS instance is shared by both halves of `apps/api`.
Shared **database**, not shared code: `database/migrations/0001` (Rudra) and
`0002` (Charan) declare no foreign key into each other's tables, so either half
boots with the other absent.

## Plug-in points

Every arrow above is a versioned JSON contract with a named owner, so the two
sides can be built and tested independently.

| Seam | Contract | Producer → Consumer |
|---|---|---|
| Telemetry | [`telemetry.schema.json`](../../packages/contracts/telemetry.schema.json) | simulator → gateway → dashboard, AI |
| Detection | [`detection.md`](../contracts/detection.md) | Faiqua → Rudra |
| Geolocation result | [`geolocation-result.md`](../contracts/geolocation-result.md) | Atul → Rudra |
| Incident | [`incident.md`](../contracts/incident.md) | Rudra → gateway → dashboard |
| Priority | [`priority-weights.md`](../contracts/priority-weights.md) | Rudra → dashboard |
| Mission & sector | [`mission.md`](../contracts/mission.md) | Charan → gateway, dashboard |
| Auth session | [`auth-session.md`](../contracts/auth-session.md) | Charan → dashboard |
| Audit log | [`audit-log.md`](../contracts/audit-log.md) | Charan → dashboard |

Everything on the wire is **snake_case** — request bodies, responses, event
payloads and fixtures alike.

Each contract ships a checked-in fixture in
[`packages/contracts/mocks/`](../../packages/contracts/mocks/), which is what
makes Section 24's "if someone is absent" test pass: a consumer can be built
and tested against the fixture before the producer exists.

## Where the core track plugs in

`apps/api/src/{auth,missions,operators,sectors,audit}` is a REST surface with
exactly one outbound edge — the mission lifecycle.

**Inbound:** nothing. The core API consumes no other service, which is why its
independent demo ([`core-demo.md`](../api/core-demo.md)) runs with every other
process stopped.

**Outbound:** the three Section 10.6 mission events. `MissionsService` emits
them on `EventEmitter2`, and two subscribers pick them up:

1. `audit/` — writes the operator action trail. In-process, non-blocking, and
   never able to fail the action that produced it.
2. `missions/mission-realtime.publisher.ts` — connects to the gateway's
   `/realtime` namespace as a Socket.IO **client** and forwards the event.
   `EventEmitter2` is in-process and `apps/realtime` is a separate process, so
   without this client nothing we emit would ever leave the API.

The publisher is off unless `REALTIME_GATEWAY_URL` is set. That is the design
law in Section 1 made concrete: the API must not require Chirag's service to be
running, and the gateway must not require ours — it falls back to a static
mission-event fixture when we are absent.

```
REALTIME_GATEWAY_URL=http://localhost:4000 npm start   # integrated
REALTIME_GATEWAY_URL=                       npm start   # standalone demo
```

`apps/api/test/mission-events.e2e-spec.ts` is the contract test on that seam:
a real Socket.IO server applying the gateway's own acceptance guard, checking
that what we put on the wire is what it accepts. Without it, a payload the
gateway rejects fails **silently** — no error anywhere, drones simply never
move.

## Phase 2 compatibility

Section 26: three adapters change, no core service is rewritten.

| Phase 1 | Phase 2 replacement | Unchanged |
|---|---|---|
| `apps/simulator` | MAVLink listener publishing the same telemetry schema | gateway, AI, dashboard |
| Recorded frames | Real camera adapter, same frame reference format | detection model |
| Browser WebRTC endpoint | Real mic/speaker unit's media stream | signalling, backend |

The mission/auth/audit system, the incident and priority logic, the detection
model, the geolocation math and the dashboard are all hardware-independent and
are not touched.

## Merge order

Per Section 16, core merges continuously — it has the fewest cross-dependencies
— then realtime, then intelligence, then AI, then the dashboard. Changes to
`packages/contracts/**` require sign-off from every listed co-signer, which is
what keeps Risk #10 (a late schema change cascading across owners) rare and
deliberate.
