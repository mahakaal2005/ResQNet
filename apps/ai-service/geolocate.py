#!/usr/bin/env python3
"""Independent demo for Atul's geolocation module -- runs fully offline from
fixtures, no dashboard, no backend, no live camera (per role doc Section 7).

Usage:
    python geolocate.py --telemetry tests/fixtures/sample_telemetry.json \\
                         --detections tests/fixtures/mock_detections.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from geolocation.projection import PixelCentroid, ProjectionError, Telemetry, project_to_ground
from validation.ground_truth import GroundTruthCase, score_against_ground_truth, summarize


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--telemetry", required=True, type=Path)
    parser.add_argument("--detections", required=True, type=Path)
    args = parser.parse_args()

    telemetry_data = json.loads(args.telemetry.read_text())
    detections = json.loads(args.detections.read_text())

    telemetry = Telemetry(
        latitude=telemetry_data["lat"],
        longitude=telemetry_data["lon"],
        altitude_m=telemetry_data["altitude_m"],
        heading_deg=telemetry_data["heading_deg"],
        gimbal_pitch_deg=telemetry_data["gimbal_pitch_deg"],
    )
    ground_truth_by_id = {
        gt["detection_id"]: gt for gt in telemetry_data.get("ground_truth", [])
    }

    validation_results = []

    for det in detections:
        centroid = PixelCentroid(x=det["centroid"]["x"], y=det["centroid"]["y"])
        try:
            result = project_to_ground(centroid, telemetry)
        except ProjectionError as exc:
            print(f"{det['detection_id']}: FAILED - {exc}")
            continue

        print(
            f"{det['detection_id']}: lat={result.latitude:.6f} lon={result.longitude:.6f} "
            f"error_m={result.error_m} method={result.method}"
        )

        gt = ground_truth_by_id.get(det["detection_id"])
        if gt:
            truth = GroundTruthCase(
                detection_id=det["detection_id"],
                expected_latitude=gt["latitude"],
                expected_longitude=gt["longitude"],
            )
            vr = score_against_ground_truth(result.latitude, result.longitude, result.error_m, truth)
            validation_results.append(vr)
            print(
                f"  -> ground truth actual_error_m={vr.error_m} "
                f"within_reported_error={vr.within_reported_error}"
            )

    if validation_results:
        print("\n--- Validation Summary ---")
        print(json.dumps(summarize(validation_results), indent=2))


if __name__ == "__main__":
    main()
