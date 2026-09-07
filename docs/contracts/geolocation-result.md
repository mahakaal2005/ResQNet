# Geolocation Result Contract

Owner: Atul (AI/CV — Tracking + Geolocation). Co-sign: Rudra (consumes this via
`POST /geolocations`). Any shape change requires sign-off from both before merge.

```json
{
  "detection_id": "DET-01",
  "latitude": 28.6142,
  "longitude": 77.2093,
  "error_m": 4.2,
  "method": "flat_ground_photogrammetric"
}
```

| Field | Type | Notes |
|---|---|---|
| `detection_id` | string | Must reference a `detection_id` already ingested via `POST /detections` |
| `latitude` / `longitude` | number | WGS84 decimal degrees |
| `error_m` | number | Estimated position error, meters |
| `method` | string | Projection method used |

Consumer: [`GeolocationIntakeService.ingestGeolocation`](../../apps/api/src/geolocation-intake/geolocation-intake.service.ts),
validated by [`GeolocationResultDto`](../../apps/api/src/geolocation-intake/dto/geolocation-result.dto.ts).

This is the trigger point into the intelligence pipeline: once both halves
(Detection + Geolocation Result) exist for a `detection_id`, dedup and
priority scoring run automatically (see [`incident.md`](./incident.md)).

Rejected with `404 Not Found` if no matching detection was ingested first.
