# API docs

Owner: Charan (Section 3, secondary ownership).

| File | What it is |
|---|---|
| [`openapi.yaml`](openapi.yaml) | OpenAPI 3.1 spec for the core surface — `/auth/*`, `/missions/*`, `/sectors/*`, `/operators/*`, `/audit-logs`. Paste into [editor.swagger.io](https://editor.swagger.io) to browse it. |
| [`core-demo.md`](core-demo.md) | The backend-core independent demo: the Compose walkthrough to run in front of judges, and the one-command test CI runs. |
| [`resqnet-core.postman_collection.json`](resqnet-core.postman_collection.json) | The same walkthrough as an importable Postman collection, with assertions. Run **Login** first; it stores the token in a collection variable. |
| [`intelligence-demo.md`](intelligence-demo.md) | Rudra's equivalent for the incident/dedup/priority modules. |

Wire-level contracts — the shapes themselves, and who has to sign off on a
change — live in [`docs/contracts/`](../contracts/):
[mission & sector](../contracts/mission.md),
[auth session](../contracts/auth-session.md),
[audit log](../contracts/audit-log.md).
