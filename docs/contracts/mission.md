# Mission & Sector Contracts

Owner: Charan. Consumed by Chirag (starts/stops simulated drone motion on the
mission events) and Ayush (renders the zone, sectors and mission controls).
Any shape change requires sign-off from both before merge.

## Mission

```json
{
  "id": "00000000-0000-4000-8000-000000000101",
  "mission_id": "MISSION-DEMO-1",
  "name": "Yamuna Flood Plain — Demo Sweep",
  "status": "active",
  "zone_polygon": {
    "type": "Polygon",
    "coordinates": [[[77.2, 28.61], [77.22, 28.61], [77.22, 28.62], [77.2, 28.62], [77.2, 28.61]]]
  },
  "sector_count": 3,
  "created_by": "00000000-0000-4000-8000-000000000001",
  "started_at": "2026-08-27T10:30:00.000Z",
  "completed_at": null,
  "created_at": "2026-08-27T10:29:00.000Z",
  "updated_at": "2026-08-27T10:30:00.000Z"
}
```

`mission_id` is the external identifier. Every other service refers to a
mission by this string, never by the surrogate `id` — Chirag's gateway already
emits `mission_id` on the mission events.

Polygons are GeoJSON with `[lon, lat]` ordering, SRID 4326.

## Sector

```json
{
  "id": "00000000-0000-4000-8000-000000000201",
  "mission_id": "MISSION-DEMO-1",
  "sector_id": "SECTOR-A",
  "polygon": {
    "type": "Polygon",
    "coordinates": [[[77.2, 28.61], [77.21, 28.61], [77.21, 28.615], [77.2, 28.615], [77.2, 28.61]]]
  },
  "assigned_drone_id": "DRONE-01",
  "created_at": "2026-08-27T10:29:00.000Z"
}
```

`sector_id` matches `^SECTOR-[A-Z]$`, the same pattern the frozen
[`telemetry.schema.json`](../../packages/contracts/telemetry.schema.json)
enforces. That caps a mission at 26 sectors, and
[`sector-geometry.ts`](../../apps/api/src/sectors/sector-geometry.ts) rejects a
larger `sector_count` at creation time rather than letting unroutable telemetry
surface later.

## Mission state machine

```
created --start--> active --pause--> paused --start--> active
                     \                  /
                      `--complete--> completed (terminal)
```

Implemented in
[`mission-state-machine.ts`](../../apps/api/src/missions/mission-state-machine.ts).
Invalid transitions are rejected with `400`.

## Endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| `POST` | `/auth/login` | — | Returns an access + refresh JWT pair |
| `POST` | `/auth/refresh` | — | Stateless refresh; no server-side token table |
| `POST` | `/missions` | `mission:create` | Body: `{ name, zone_polygon, sector_count }` |
| `GET` | `/missions/:id` | `mission:read` | By `mission_id` |
| `PATCH` | `/missions/:id/status` | `mission:update-status` | Body: `{ status }`. Publishes the event for the edge |
| `POST` | `/sectors` | `sector:create` | |
| `GET` | `/missions/:id/sectors` | `sector:read` | |
| `GET` | `/operators/me` | `operator:read-self` | |
| `GET` | `/audit-logs?mission_id=` | `audit:read` | |

## Events published

| Event | Fires when | Payload |
|---|---|---|
| `mission.started` | `created → active` **and** `paused → active` | `{ mission_id, status }` |
| `mission.paused` | `active → paused` | `{ mission_id, status }` |
| `mission.completed` | `active\|paused → completed` | `{ mission_id, status }` |

Section 10.6 defines exactly three mission events, so a resume re-emits
`mission.started` rather than introducing a fourth — which is also the effect
Chirag's gateway wants, since it restarts drone motion on that event.

## RBAC

Three roles, nested: `viewer ⊂ operator ⊂ admin`. `viewer` is strictly
read-only, serving the district-authority use case in PRD Section 6. Matrix in
[`rbac.ts`](../../apps/api/src/auth/rbac.ts).
