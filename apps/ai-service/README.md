# apps/ai-service — Detection (Faiqua) + Tracking/Geolocation (Atul)

| Folder | Owner |
|---|---|
| `src/detection/**`, `src/training/**`, `models/**` | Faiqua |
| `src/tracking/**`, `src/geolocation/**`, `validation/**` | Atul |

Never edit the other person's folder. Both consume fixtures from
`apps/simulator/sample_frames/` and `apps/simulator/sample_telemetry.json` —
never block on the live simulator.

## Atul's modules: tracking + geolocation + validation

**Status**: starter implementation drafted ahead of Atul actively picking up
`feature/ai-geolocation` (nobody had started this branch as of 2026-08-28).
Meant as a working reference to build on or replace — not a claim that this
is Atul's final design. Review, adjust, and take ownership as needed.

### Geolocation (`src/geolocation/`)
- `projection.py` — flat-ground photogrammetric projection (PRD §5.2): pixel
  centroid + drone telemetry → ground lat/lon + error estimate. Pure
  functions, zero dependencies, fully unit-testable.
- `service.py` — `POST /ai/geolocate` FastAPI endpoint wrapping the same logic.

Camera intrinsics (FOV, resolution) are fixed placeholder constants in
`projection.py` — the telemetry contract doesn't carry them, so they need
calibration against whatever the simulator/real camera actually uses.

### Tracking (`src/tracking/`)
- `tracker.py` — greedy centroid-distance identity tracker across frames.
  Not a full SORT/Kalman implementation; sufficient for Phase 1's scope.

### Validation (`src/validation/`)
- `ground_truth.py` — scores geolocation output against known synthetic
  coordinates, produces the mean/max error + calibration-rate report
  referenced in the role doc's Definition of Done.

## Independent demo

```bash
cd apps/ai-service
pip install -r requirements.txt   # only needed for the FastAPI service, not the CLI/tests
python geolocate.py --telemetry tests/fixtures/sample_telemetry.json \
                     --detections tests/fixtures/mock_detections.json
```

No backend, no dashboard, no live camera required — runs fully from the
committed fixtures.

## Tests

```bash
python -m pytest -v
```

12 tests: hand-computed projection cases (nadir, 45° gimbal), a fixture
round-trip regression test, tracking identity persistence across a 20-frame
synthetic sequence with no ID switches, and ground-truth scoring.

## Contracts

Detection and Geolocation Result shapes are frozen in
[`docs/contracts/detection.md`](../../docs/contracts/detection.md) and
[`docs/contracts/geolocation-result.md`](../../docs/contracts/geolocation-result.md).
