"""Flat-ground photogrammetric projection: pixel centroid + drone telemetry
-> ground lat/lon, under the Phase 1 flat-ground assumption (PRD 5.2).

Camera intrinsics (FOV, resolution) are not part of the per-frame telemetry
contract (docs/contracts/detection.md only carries drone GPS/altitude/heading/
gimbal pitch), so they're fixed constants here until a real camera spec
exists. This is a disclosed simplification, matching the honesty pattern
already used in priority-weights.md.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

EARTH_RADIUS_M = 6_371_000.0

# Camera intrinsics placeholder -- calibrate against the real simulator/camera
# once Chirag's telemetry contract ships actual resolution/FOV values.
IMAGE_WIDTH_PX = 640
IMAGE_HEIGHT_PX = 480
HORIZONTAL_FOV_DEG = 84.0
VERTICAL_FOV_DEG = 63.0

# Gimbal pitch convention: 0deg = horizontal (looking at horizon),
# -90deg = nadir (looking straight down). Matches common drone gimbal specs.


@dataclass
class Telemetry:
    latitude: float
    longitude: float
    altitude_m: float
    heading_deg: float
    gimbal_pitch_deg: float


@dataclass
class PixelCentroid:
    x: float
    y: float


@dataclass
class GeolocationResult:
    latitude: float
    longitude: float
    error_m: float
    method: str = "flat_ground_photogrammetric"


class ProjectionError(ValueError):
    """Raised when the projected ray points above the horizon (no ground intersection)."""


def project_to_ground(
    centroid: PixelCentroid,
    telemetry: Telemetry,
    *,
    image_width_px: int = IMAGE_WIDTH_PX,
    image_height_px: int = IMAGE_HEIGHT_PX,
    horizontal_fov_deg: float = HORIZONTAL_FOV_DEG,
    vertical_fov_deg: float = VERTICAL_FOV_DEG,
) -> GeolocationResult:
    """Projects a pixel centroid onto the flat ground plane and returns lat/lon.

    Steps: pixel offset from image center -> angular offset within the FOV ->
    combine with gimbal pitch for total depression angle -> ground distance
    via altitude/tan(depression) -> destination point along (heading + bearing
    offset) from the drone's GPS position.
    """
    dx_ratio = (centroid.x - image_width_px / 2) / (image_width_px / 2)
    dy_ratio = (centroid.y - image_height_px / 2) / (image_height_px / 2)

    horizontal_angle_deg = dx_ratio * (horizontal_fov_deg / 2)
    vertical_angle_deg = dy_ratio * (vertical_fov_deg / 2)

    # depression = angle below horizontal; nadir gimbal (-90) + centered pixel -> 90deg (straight down)
    depression_deg = -telemetry.gimbal_pitch_deg + vertical_angle_deg

    if depression_deg <= 0 or depression_deg > 90:
        raise ProjectionError(
            f"Ray does not intersect the ground plane (depression={depression_deg:.2f}deg); "
            "check gimbal pitch / pixel position."
        )

    # depression == 90 means looking straight down: target is directly below the drone.
    ground_distance_m = (
        0.0 if depression_deg == 90 else telemetry.altitude_m / math.tan(math.radians(depression_deg))
    )
    bearing_deg = (telemetry.heading_deg + horizontal_angle_deg) % 360

    lat, lon = _destination_point(
        telemetry.latitude, telemetry.longitude, ground_distance_m, bearing_deg
    )

    error_m = estimate_error(telemetry.altitude_m, ground_distance_m, depression_deg)

    return GeolocationResult(latitude=lat, longitude=lon, error_m=error_m)


def estimate_error(altitude_m: float, ground_distance_m: float, depression_deg: float) -> float:
    """Documented, simple error model -- not a rigorous sensor-fusion estimate.

    Grows with ground distance (angular error compounds over range) and with
    shallow depression angles (near-horizon shots are far less precise on a
    flat-ground assumption). Base term covers GPS + gimbal quantization noise.
    """
    base_error_m = 2.0
    range_term = 0.05 * ground_distance_m
    shallow_angle_penalty = max(0.0, (30 - depression_deg)) * 0.3
    return round(base_error_m + range_term + shallow_angle_penalty, 2)


def _destination_point(
    lat_deg: float, lon_deg: float, distance_m: float, bearing_deg: float
) -> tuple[float, float]:
    """Standard great-circle destination point given start, distance, bearing."""
    lat1 = math.radians(lat_deg)
    lon1 = math.radians(lon_deg)
    bearing = math.radians(bearing_deg)
    angular_distance = distance_m / EARTH_RADIUS_M

    lat2 = math.asin(
        math.sin(lat1) * math.cos(angular_distance)
        + math.cos(lat1) * math.sin(angular_distance) * math.cos(bearing)
    )
    lon2 = lon1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat1),
        math.cos(angular_distance) - math.sin(lat1) * math.sin(lat2),
    )

    return math.degrees(lat2), (math.degrees(lon2) + 540) % 360 - 180
