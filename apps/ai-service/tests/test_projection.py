import json
import math
from pathlib import Path

import pytest
from geolocation.projection import (
    IMAGE_HEIGHT_PX,
    IMAGE_WIDTH_PX,
    GeolocationResult,
    PixelCentroid,
    ProjectionError,
    Telemetry,
    project_to_ground,
)

FIXTURES = Path(__file__).parent / "fixtures"


def centered_pixel() -> PixelCentroid:
    return PixelCentroid(x=IMAGE_WIDTH_PX / 2, y=IMAGE_HEIGHT_PX / 2)


def test_nadir_centered_pixel_projects_directly_below_drone():
    """Hand-computed case: gimbal straight down (-90) + centered pixel ->
    depression=90deg -> ground_distance = altitude/tan(90) = 0, so the
    target is exactly the drone's own GPS position."""
    telemetry = Telemetry(
        latitude=10.0, longitude=20.0, altitude_m=100.0, heading_deg=0.0, gimbal_pitch_deg=-90.0
    )
    result = project_to_ground(centered_pixel(), telemetry)

    assert result.latitude == pytest.approx(10.0, abs=1e-6)
    assert result.longitude == pytest.approx(20.0, abs=1e-6)


def test_45deg_gimbal_centered_pixel_matches_hand_calculation():
    """Hand-computed case: gimbal at -45deg, centered pixel (no pixel offset)
    -> depression=45deg -> ground_distance = altitude/tan(45) = altitude
    exactly. Heading=0 (due north) -> bearing=0 -> longitude unchanged,
    latitude shifts by distance/EARTH_RADIUS_M radians."""
    altitude = 100.0
    telemetry = Telemetry(
        latitude=0.0, longitude=0.0, altitude_m=altitude, heading_deg=0.0, gimbal_pitch_deg=-45.0
    )
    result = project_to_ground(centered_pixel(), telemetry)

    expected_distance_m = altitude  # tan(45) == 1
    expected_lat = math.degrees(expected_distance_m / 6_371_000.0)

    assert result.longitude == pytest.approx(0.0, abs=1e-9)
    assert result.latitude == pytest.approx(expected_lat, rel=1e-6)


def test_raises_when_ray_points_above_horizon():
    """gimbal=0 (horizontal) + centered pixel -> depression=0 -> ray is
    parallel to the ground, never intersects it."""
    telemetry = Telemetry(
        latitude=0.0, longitude=0.0, altitude_m=100.0, heading_deg=0.0, gimbal_pitch_deg=0.0
    )
    with pytest.raises(ProjectionError):
        project_to_ground(centered_pixel(), telemetry)


def test_fixture_round_trip_matches_synthetic_ground_truth():
    """Regression test against the committed fixture set -- proves the
    exact numbers geolocate.py demo output is built on stay correct."""
    telemetry_data = json.loads((FIXTURES / "sample_telemetry.json").read_text())
    detections = json.loads((FIXTURES / "mock_detections.json").read_text())
    ground_truth = {gt["detection_id"]: gt for gt in telemetry_data["ground_truth"]}

    telemetry = Telemetry(
        latitude=telemetry_data["lat"],
        longitude=telemetry_data["lon"],
        altitude_m=telemetry_data["altitude_m"],
        heading_deg=telemetry_data["heading_deg"],
        gimbal_pitch_deg=telemetry_data["gimbal_pitch_deg"],
    )

    for det in detections:
        centroid = PixelCentroid(x=det["centroid"]["x"], y=det["centroid"]["y"])
        result: GeolocationResult = project_to_ground(centroid, telemetry)
        truth = ground_truth[det["detection_id"]]

        assert result.latitude == pytest.approx(truth["latitude"], abs=1e-4)
        assert result.longitude == pytest.approx(truth["longitude"], abs=1e-4)
        assert result.error_m > 0
