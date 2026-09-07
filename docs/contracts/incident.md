# Incident Contract

Owner: Rudra. Consumed by Chirag (broadcasts over WebSocket) and Ayush
(renders on the dashboard). Any shape change requires sign-off from both
before merge.

```json
{
  "id": "43b75e76-6a26-4bef-a4f6-69e698775287",
  "incidentId": "INC-A21ADCDC",
  "latitude": 28.61423,
  "longitude": 77.20934,
  "location": { "type": "Point", "coordinates": [77.20934, 28.61423] },
  "survivorCountEstimate": 2,
  "confidence": 0.91,
  "priorityScore": 31,
  "status": "open",
  "firstSeen": "2026-08-27T10:30:05.000Z",
  "lastSeen": "2026-08-27T10:31:40.000Z",
  "evidence": [
    { "frame_ref": "DET-01", "detection_id": "DET-01" },
    { "frame_ref": "DET-02", "detection_id": "DET-02" }
  ],
  "sourceDrones": ["DRONE-01", "DRONE-02"],
  "sectorId": "SECTOR-A",
  "operatorConfirmed": false,
  "distressFlag": false
}
```

`status` enum: `open → confirmed → dispatched → resolved` (forward-only, see
[`incident-state-machine.ts`](../../apps/api/src/incidents/incident-state-machine.ts)).

## Endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/incidents` | All incidents, ordered by `priorityScore` desc |
| `GET` | `/incidents/:id` | 404 if not found |
| `PATCH` | `/incidents/:id/status` | Body: `{ status, distress_flag? }`. Rejects invalid transitions with `400`. Recomputes priority if `distress_flag` changes. |
| `GET` | `/incidents/:id/priority-breakdown` | Returns the latest [`PriorityBreakdown`](./priority-weights.md) |

## Events

Published internally via `EventEmitter2` (bridged to WebSocket by Chirag's
gateway once integrated): `incident.created`, `incident.updated`,
`incident.priority_changed`.

## incident_events (audit trail)

Every mutation is also logged to the `incident_events` table
(`incident_id`, `event_type`, `payload`, `created_at`) — not exposed via a
dedicated endpoint in Phase 1, queryable directly for debugging/audit.

## Dedup

New Detection+Geolocation pairs merge into an existing incident when both:
- within `DEDUP_RADIUS_METERS` (50m) of an **open** incident's location, and
- within `DEDUP_TIME_WINDOW_MINUTES` (10 min) of its `last_seen`.

See [`dedup.ts`](../../apps/api/src/incidents/dedup.ts). Confirmed/dispatched/
resolved incidents are never silently re-merged into.
