"""Expanded validation coverage: the earlier fixture set only had 2 points
close together in the frame center. These cases exercise FOV edges/corners,
close/far range, and non-zero headings -- computed via the exact inverse of
project_to_ground's math, so each case's pixel is the analytically-correct
answer for its target lat/lon (round-trip proof, not hand-picked numbers).
"""

import pytest
from geolocation.projection import PixelCentroid, Telemetry, project_to_ground
from validation.ground_truth import GroundTruthCase, score_against_ground_truth, summarize

DRONE_LAT, DRONE_LON, ALTITUDE = 28.6000, 77.2000, 80.0

# (name, heading_deg, gimbal_pitch_deg, pixel_x, pixel_y, expected_lat, expected_lon)
EDGE_CASES = [
    ("near_horizontal_edge", 0.0, -50.0, 617.1, 240.0, 28.600469, 77.200433),
    ("near_left_edge", 0.0, -50.0, 22.9, 240.0, 28.600469, 77.199567),
    ("near_top_edge", 0.0, -50.0, 320.0, 19.0, 28.601874, 77.200000),
    ("near_bottom_edge", 0.0, -50.0, 320.0, 461.0, 28.600140, 77.200000),
    ("near_corner", 0.0, -50.0, 609.5, 453.3, 28.600121, 77.200107),
    ("close_range_steep", 0.0, -85.0, 320.0, 240.0, 28.600063, 77.200000),
    ("far_shallow", 0.0, -20.0, 320.0, 240.0, 28.601977, 77.200000),
    ("heading_south", 180.0, -60.0, 320.0, 240.0, 28.599585, 77.200000),
    ("heading_west", 270.0, -60.0, 320.0, 240.0, 28.600000, 77.199527),
]


@pytest.mark.parametrize(
    "name,heading,gimbal,px,py,exp_lat,exp_lon",
    EDGE_CASES,
    ids=[c[0] for c in EDGE_CASES],
)
def test_edge_case_round_trips_within_tolerance(name, heading, gimbal, px, py, exp_lat, exp_lon):
    telemetry = Telemetry(
        latitude=DRONE_LAT,
        longitude=DRONE_LON,
        altitude_m=ALTITUDE,
        heading_deg=heading,
        gimbal_pitch_deg=gimbal,
    )
    result = project_to_ground(PixelCentroid(px, py), telemetry)

    assert result.latitude == pytest.approx(exp_lat, abs=1e-4)
    assert result.longitude == pytest.approx(exp_lon, abs=1e-4)


def test_calibration_rate_across_diverse_geometry_is_acceptable():
    """Aggregate check: across FOV edges, corners, near/far range, and
    varied headings, the reported error_m should bound the actual error
    (within the 1.5x tolerance) at least 90% of the time -- the metric the
    role doc's Definition of Done calls the "accuracy number for judges"."""
    results = []
    for name, heading, gimbal, px, py, exp_lat, exp_lon in EDGE_CASES:
        telemetry = Telemetry(
            latitude=DRONE_LAT,
            longitude=DRONE_LON,
            altitude_m=ALTITUDE,
            heading_deg=heading,
            gimbal_pitch_deg=gimbal,
        )
        result = project_to_ground(PixelCentroid(px, py), telemetry)
        truth = GroundTruthCase(name, expected_latitude=exp_lat, expected_longitude=exp_lon)
        results.append(score_against_ground_truth(result.latitude, result.longitude, result.error_m, truth))

    summary = summarize(results)

    assert summary["count"] == len(EDGE_CASES)
    assert summary["calibration_rate"] >= 0.9, (
        f"error model under-calibrated across diverse geometry: {summary}"
    )
    # sanity bound -- if this creeps into the km range, something is broken
    assert summary["max_error_m"] < 50.0
