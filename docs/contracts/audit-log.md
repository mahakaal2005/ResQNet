# Audit Log Contract

**Version: 1.0 · Status: FROZEN for Phase 1.**

Owner: Charan. Consumed by Ayush (the Week-3 audit log view). Any shape change
requires sign-off before merge and bumps the version above.

Served by `GET /audit-logs?mission_id=&limit=` — newest first, `limit`
defaults to 200. Requires the `audit:read` permission, which all three roles
have.

| Version | Change |
|---|---|
| 1.0 | Initial freeze: `AuditLogEntry`, the action vocabulary, and the mission-scoping rule. |

## AuditLogEntry

```json
{
  "id": "9f1c2f5e-6c3e-4a2b-9f10-2f4d7a1c0b33",
  "missionId": "MISSION-DEMO-1",
  "actorUserId": "00000000-0000-4000-8000-000000000002",
  "action": "mission.started",
  "entityType": "mission",
  "entityId": "MISSION-DEMO-1",
  "payload": { "from": "created", "to": "active" },
  "timestamp": "2026-08-27T10:30:00.000Z"
}
```

Property names are camelCase on the wire — this endpoint returns the TypeORM
entity directly, matching how `Mission` and `Sector` are served.

`missionId` is **nullable**: not every audited action is mission-scoped. A
login is not, so `auth.*` rows appear only in the unfiltered `GET /audit-logs`.

`actorUserId` is **nullable** so the system itself can be the actor for events
with no human behind them — every incident row is one, since those come off
the event bus rather than from an operator's request.

`payload` is free-form JSONB and is the one part of this contract that is *not*
frozen per-action: treat an unrecognised key as informational and render it
generically. The keys documented below are the ones that will not disappear.

## Action vocabulary

| Action | `entityType` | `missionId` | `payload` |
|---|---|---|---|
| `auth.login` | `user` | always null | `{ email, role }` |
| `auth.login_failed` | `user` | always null | `{ email }` |
| `mission.created` | `mission` | set | `{ name, sector_count }` |
| `mission.started` | `mission` | set | `{ from, to }` |
| `mission.paused` | `mission` | set | `{ from, to }` |
| `mission.completed` | `mission` | set | `{ from, to }` |
| `sector.assigned` | `sector` | set | `{ count, sector_ids, source }` |
| `sector.created` | `sector` | set | `{ assigned_drone_id }` |
| `sector.updated` | `sector` | set | `{ assigned_drone_id }` |
| `incident.created` | `incident` | best-effort | `{ sector_id, priority_score }` |
| `incident.updated` | `incident` | best-effort | `{ status, operator_confirmed }` |
| `incident.priority_changed` | `incident` | null | `{ breakdown }` |

`auth.login_failed` deliberately records the attempted address and **never**
the password or a hash of it.

`sector.assigned` is written **once per mission**, for the whole zone split —
not once per sector. Creating a mission is one operator action, and N rows per
creation would bury the mission events around it. `entityId` is null on that
row; the sector labels are in `payload.sector_ids`.

`sector.created` vs `sector.updated` distinguishes an operator adding a sector
the zone split never claimed from one refining a sector it did.

A rejected request writes **nothing**: a 400 or 403 leaves no audit row.

### Mission scoping of incident rows

`incidents` carries a `sector_id` but no `mission_id`, so incident rows are
scoped by mapping that label back through our `sectors` table, ignoring
completed missions. When two live missions both define the label the answer is
not knowable from the label alone, and `missionId` stays null rather than
guessing — the row is still in the unfiltered log.

`incident.priority_changed` carries no `sector_id` on its event payload, so it
is always unscoped. Closing that needs `sector_id` added to the event in
`apps/api/src/incidents/**` — Rudra's file and Rudra's contract.

## Guarantees

Writing an audit row **never** fails an operator action. `AuditService.record()`
swallows and logs its own errors: the audit log is a read-only, non-blocking
consumer (Section 3), so losing a row noisily beats taking down the action that
produced it. A consumer must therefore treat the log as near-complete rather
than as a transactional ledger.
