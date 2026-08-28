# packages/contracts/mocks

Cross-service mock fixtures, checked in Day 1 of Week 1 so nobody blocks on
anybody else's real implementation (the "design law" in Section 1).

| File | Owner | Used by |
|---|---|---|
| mock_users.json | Charan | Rudra, Chirag, Ayush |
| mock_missions.json | Charan | Rudra, Chirag, Ayush |
| mock_sectors.json | Charan | Rudra, Chirag, Ayush |
| mock_detection.json | Rudra | Charan, Ayush (test fixture, 2 overlapping-sector examples) |
| mock_geolocation_result.json | Rudra | Charan, Ayush |

(Faiqua's `mock_detections.json` and Atul's synthetic ground truth live next
to their own services / in `apps/simulator/`, per Section 15's table.)
