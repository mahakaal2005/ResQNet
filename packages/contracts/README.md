# packages/contracts

Shared JSON schemas. Everyone reads this folder; nobody owns it alone. Changes to
any file here require sign-off from every listed owner/co-signer (Section 16 of
the Team Role Distribution plan) before merge.

## telemetry.schema.json
- **Owner:** Chirag
- **Co-sign:** Atul on `altitude_m`, `heading_deg`, `gimbal_pitch_deg`
- **Status:** FROZEN for Week 1
- Emitted by `apps/simulator` today; a Phase-2 MAVLink adapter will emit the
  exact same shape onto the same topic, so no downstream service changes.

## WebSocket events (transport owned by Chirag; payload owned by producer)

Namespace: `/realtime`

| Event | Producer | Payload |
|---|---|---|
| `drone.telemetry` | Chirag (gateway, from simulator) | `DroneTelemetry` (see telemetry.schema.json) |
| `drone.status` | Chirag | `{ drone_id, status: "connected" \| "lost" \| "reconnected", sector_id, last_seen }` |
| `network.offline` | Chirag (edge queue) | `{ drone_id, since }` |
| `network.reconnected` | Chirag | `{ drone_id, at }` |
| `sync.completed` | Chirag | `{ drone_id, records_flushed, from, to }` |
| `mission.started` / `mission.paused` | Charan | `{ mission_id, status }` — consumed by Chirag to start/stop simulated drone motion; mocked locally with a static fixture event until Charan's API is live. |

Co-sign on payload *shape* changes for `drone.*` / `network.*` / `sync.*`: Ayush
(dashboard is the primary consumer of every event).
