# incidents (owner: Rudra)
POST /incidents, GET /incidents, GET /incidents/:id, PATCH /incidents/:id/status
Tables: incidents, incident_events. Publishes: incident.created, incident.updated, incident.priority_changed.
Contract owned here: Incident object (Section 10.4). Sign-off required jointly with anyone consuming it.
