# sectors (owner: Charan)

`POST /sectors`, `GET /missions/:id/sectors`. Table: `sectors`.
Mock fixture: `packages/contracts/mocks/mock_sectors.json`.

`POST /sectors` upserts on `(mission_id, sector_id)`: mission creation has
already claimed SECTOR-A..N with generated strips, so pinning an exact polygon
— the layout `apps/simulator/src/sectors.ts` flies, for instance — or
assigning a drone overwrites the generated strip rather than colliding with it.
The polygon must lie inside the mission zone.

`sector-geometry.ts` is pure and framework-free: polygon validation, the
bounding-box containment check, and the zone split. `sector_id` matches
`^SECTOR-[A-Z]$` — the same pattern the frozen telemetry schema enforces — so
a sector no drone could legally report cannot be created. That is also why a
mission may hold at most 26 sectors.

`assigned_drone_id` is a plain identifier, not a foreign key: the `drones`
table belongs to Chirag and may not exist when this service runs alone.
