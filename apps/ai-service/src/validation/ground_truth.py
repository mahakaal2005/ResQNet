"""Scores geolocation results against known synthetic ground truth.

This produces the "accuracy" number referenced in the role doc's Definition
of Done for Atul's module -- reported honestly as algorithm-validated
against synthetic coordinates, not field-tested (PRD risk #2).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_000.0


@dataclass
class GroundTruthCase:
    detection_id: str
    expected_latitude: float
    expected_longitude: float


@dataclass
class ValidationResult:
    detection_id: str
    error_m: float
    reported_error_m: float
    within_reported_error: bool


def haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def score_against_ground_truth(
    predicted_lat: float,
    predicted_lon: float,
    reported_error_m: float,
    truth: GroundTruthCase,
) -> ValidationResult:
    actual_error_m = haversine_distance_m(
        predicted_lat, predicted_lon, truth.expected_latitude, truth.expected_longitude
    )
    return ValidationResult(
        detection_id=truth.detection_id,
        error_m=round(actual_error_m, 2),
        reported_error_m=reported_error_m,
        # a well-calibrated error estimate should bound the actual error most
        # of the time; flag cases where it doesn't for later recalibration
        within_reported_error=actual_error_m <= reported_error_m * 1.5,
    )


def summarize(results: list[ValidationResult]) -> dict:
    if not results:
        return {"count": 0, "mean_error_m": 0.0, "max_error_m": 0.0, "calibration_rate": 0.0}

    errors = [r.error_m for r in results]
    calibrated = sum(1 for r in results if r.within_reported_error)

    return {
        "count": len(results),
        "mean_error_m": round(sum(errors) / len(errors), 2),
        "max_error_m": round(max(errors), 2),
        "calibration_rate": round(calibrated / len(results), 2),
    }
