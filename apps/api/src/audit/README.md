# audit (owner: Charan)

`GET /audit-logs?mission_id=` — operator action trail, newest first.
Table: `audit_logs`.

A read-only, non-blocking consumer (Section 3): `AuditService.record()` never
throws, so a failed audit write cannot take down the operator action that
produced it — it is logged loudly instead.

What lands here: `auth.login`, `auth.login_failed`, `mission.created`,
`mission.started`, `mission.paused`, `mission.completed`, and — via
`incident-audit.listener.ts`, when the intelligence modules are running —
`incident.created`, `incident.updated`, `incident.priority_changed`. That
listener is structurally typed and never imports from `src/incidents/**`; if
those modules are absent the events simply never fire.

`mission_id` is nullable because not every action is mission-scoped (a login is
not), so logins appear only in the unfiltered log.
