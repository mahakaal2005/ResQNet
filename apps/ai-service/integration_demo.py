#!/usr/bin/env python3
"""End-to-end integration demo: Atul's geolocation module -> Rudra's live
incident API. This is the first real cross-module wiring in the project --
proves the two independently-built services actually work together, not
just against each other's fixtures.

Requires Rudra's apps/api running and reachable (see docs/api/intelligence-demo.md
for how to start it against a real Postgres+PostGIS instance).

Usage:
    python integration_demo.py --api-url http://localhost:3060 \\
        --telemetry tests/fixtures/sample_telemetry.json \\
        --detections tests/fixtures/mock_detections.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / "src"))

from geolocation.incident_api_client import (
    DetectionPayload,
    GeolocationResultPayload,
    IncidentApiClient,
    IncidentApiError,
)
from geolocation.projection import PixelCentroid, ProjectionError, Telemetry, project_to_ground


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api-url", required=True)
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

    client = IncidentApiClient(args.api_url)

    for det in detections:
        detection_payload = DetectionPayload(
            detection_id=det["detection_id"],
            drone_id=det["drone_id"],
            sector_id=det["sector_id"],
            timestamp=det["timestamp"],
            bbox=det["bbox"],
            confidence=det["confidence"],
            centroid=det["centroid"],
        )

        print(f"-> POST /detections {det['detection_id']}")
        try:
            client.post_detection(detection_payload)
        except IncidentApiError as exc:
            print(f"   FAILED: {exc}")
            continue

        centroid = PixelCentroid(x=det["centroid"]["x"], y=det["centroid"]["y"])
        try:
            geo_result = project_to_ground(centroid, telemetry)
        except ProjectionError as exc:
            print(f"   geolocation FAILED: {exc}")
            continue

        geolocation_payload = GeolocationResultPayload(
            detection_id=det["detection_id"],
            latitude=geo_result.latitude,
            longitude=geo_result.longitude,
            error_m=geo_result.error_m,
            method=geo_result.method,
        )

        print(
            f"-> POST /geolocations {det['detection_id']} "
            f"lat={geo_result.latitude:.6f} lon={geo_result.longitude:.6f}"
        )
        try:
            response = client.post_geolocation(geolocation_payload)
        except IncidentApiError as exc:
            print(f"   FAILED: {exc}")
            continue

        incident = response["incident"]
        print(
            f"   -> incident {incident['incidentId']} "
            f"status={incident['status']} survivor_count={incident['survivorCountEstimate']} "
            f"priority={incident['priorityScore']}"
        )

    print("\n--- Final incident state ---")
    print(json.dumps(client.get_incidents(), indent=2))


if __name__ == "__main__":
    main()
