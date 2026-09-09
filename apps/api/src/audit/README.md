# audit (owner: Charan)

`GET /audit-logs?mission_id=&limit=` — operator action trail, newest first.
Table: `audit_logs`. Contract:
[`docs/contracts/audit-log.md`](../../../../docs/contracts/audit-log.md).

A read-only, non-blocking consumer (Section 3): `AuditService.record()` never
throws, so a failed audit write cannot take down the operator action that
produced it — it is logged loudly instead.

What lands here:

| Source | Actions |
|---|---|
| `auth/auth.service.ts` | `auth.login`, `auth.login_failed` |
| `missions/missions.service.ts` | `mission.created`, `mission.started`, `mission.paused`, `mission.completed` |
| `sectors/sectors.service.ts` | `sector.assigned`, `sector.created`, `sector.updated` |
| `incident-audit.listener.ts` | `incident.created`, `incident.updated`, `incident.priority_changed` |

The listener is structurally typed and never imports from `src/incidents/**`;
if those modules are absent the events simply never fire.

`mission_id` is nullable because not every action is mission-scoped (a login is
not), so logins appear only in the unfiltered log.

## Scoping incident rows to a mission

Rudra's `incidents` table carries a `sector_id` but no `mission_id`, so an
incident event cannot name its mission. Without help, every incident row would
be missing from `GET /audit-logs?mission_id=` — the one query the dashboard
runs — which would make "the whole story of a mission in one query" false.

Scoping never gates the write. `sectors` does not exist when the intelligence
modules run standalone against 0001 alone, and a throw there would abort the
handler before `AuditService.record()` — dropping the row entirely, with only a
logged error, because @nestjs/event-emitter swallows handler exceptions.
`incident-audit.listener.spec.ts` pins that behaviour.

`mission-scope.ts` closes that: the listener maps the sector label back through
our own `sectors` table, ignoring completed missions. Phase 1 runs one live
mission at a time, so a label normally resolves to exactly one. When it does
not, `mission_id` stays null rather than guessing — a row filed under the wrong
mission is worse than one missing from a filter. The ambiguity rule is pure and
unit-tested in `mission-scope.spec.ts`.

`incident.priority_changed` carries no `sector_id` on its payload and is always
unscoped. Closing that needs the field added to the event in
`src/incidents/**` — Rudra's file and Rudra's contract, so it is flagged, not
changed.
