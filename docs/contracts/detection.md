# Detection Contract

Owner: Faiqua (AI/CV — Detection). Co-sign: Rudra (consumes this via
`POST /detections`). Any shape change requires sign-off from both before merge.

```json
{
  "detection_id": "DET-01",
  "drone_id": "DRONE-01",
  "sector_id": "SECTOR-A",
  "timestamp": "2026-08-27T10:30:05Z",
  "bbox": { "x": 120, "y": 80, "w": 40, "h": 90 },
  "confidence": 0.87,
  "centroid": { "x": 140, "y": 125 }
}
```

| Field | Type | Notes |
|---|---|---|
| `detection_id` | string | Unique per detection, primary join key with the Geolocation Result contract |
| `drone_id` | string | Source drone |
| `sector_id` | string | Search sector, used to scope dedup lookups |
| `timestamp` | ISO 8601 string | Frame capture time |
| `bbox` | `{x, y, w, h}` | Pixel-space bounding box |
| `confidence` | number 0–1 | Detector confidence |
| `centroid` | `{x, y}` | Pixel-space centroid |

Consumer: [`GeolocationIntakeService.ingestDetection`](../../apps/api/src/geolocation-intake/geolocation-intake.service.ts),
validated by [`DetectionDto`](../../apps/api/src/geolocation-intake/dto/detection.dto.ts).

Rejected if `detection_id` was already ingested (`409 Conflict`).
