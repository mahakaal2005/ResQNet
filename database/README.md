# database

`migrations/` — gatekept by Charan. One migration file per PR, sequential
numbering. Charan reviews all of them regardless of which table's owner
authored it (Section 3, Section 11, Section 16).

`seeds/` — seed script should produce a demo-ready mission with 3 sectors.

Table ownership:
| Table | Owner |
|---|---|
| users, missions, sectors, audit_logs | Charan |
| drones, drone_telemetry, sync_queue | Chirag |
| detections, geolocations, incidents, incident_events, priority_scores | Rudra |

Rule: no two people modify the same table's migration in the same PR without
the table owner's sign-off.
