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

## Realtime gateway transport events

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `telemetry` | registered drone -> gateway | `DroneTelemetry` | Ingest a telemetry tick. |
| `telemetry.rejected` | gateway -> sender | `{ reason, errors? }` | Reject invalid, unregistered, duplicate, or stale telemetry. |
| `drone.register` | drone -> gateway | `{ drone_id, device_token }` | Register a drone socket; real token verification is pending auth integration. |
| `drone.registered` | gateway -> drone | `{ drone_id, connected_at }` | Registration acknowledgement. |
| `drone.command` | operator -> gateway -> target drone | `{ command_id, drone_id, type, issued_by, issued_at }` | Route a command only to its registered target. |
| `drone.command.ack` | drone -> gateway -> clients | `{ command_id, drone_id, status, at, reason? }` | Relay command execution acknowledgement. |
| `drone.command.rejected` | gateway -> operator | `{ command_id?, drone_id?, reason }` | Reject malformed commands or unavailable targets. |
