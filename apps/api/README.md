# apps/api — Backend Core + Intelligence

One deployable service, split into non-overlapping module folders so two
owners never edit the same file (Section 12).

| Folder | Owner | Notes |
|---|---|---|
| `src/auth/**` | Charan | JWT login/refresh |
| `src/missions/**` | Charan | mission CRUD + state machine |
| `src/operators/**` | Charan | GET /operators/me |
| `src/sectors/**` | Charan | sector assignment |
| `src/audit/**` | Charan | audit log (read-only event consumer) |
| `src/incidents/**` | Rudra | incident CRUD + status |
| `src/priority/**` | Rudra | priority scoring, always returns breakdown |
| `src/geolocation-intake/**` | Rudra | POST /detections, POST /geolocations |

Charan is the migrations gatekeeper — reviews every PR under `database/migrations/**`
regardless of table owner (Section 3 / Section 11).

Never modify: `apps/realtime/**`, `apps/ai-service/**`, `apps/dashboard/**`.
