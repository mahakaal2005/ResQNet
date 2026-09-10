"""Nadir-camera flat-ground projection for the frozen geolocation contract."""
from __future__ import annotations

from math import cos, pi
from typing import Any

EARTH_RADIUS_M = 6_378_137.0


class FlatGroundGeolocator:
    def __init__(self, horizontal_fov_deg: float = 72.0) -> None:
        self.horizontal_fov_deg = horizontal_fov_deg

    def locate(self, detection: dict[str, Any], telemetry: dict[str, Any], image_width: int, image_height: int) -> dict[str, Any]:
        if image_width <= 0 or image_height <= 0 or telemetry["altitude_m"] <= 0:
            raise ValueError("image dimensions and altitude_m must be positive")
        # Ground footprint is derived from the horizontal FOV; preserve aspect
        # ratio for vertical footprint. A -90 degree gimbal is the supported
        # Phase-1 configuration.
        import math
        width_m = 2 * telemetry["altitude_m"] * math.tan(math.radians(self.horizontal_fov_deg / 2))
        height_m = width_m * image_height / image_width
        centroid = detection["centroid"]
        east_m = (centroid["x"] / image_width - .5) * width_m
        north_m = (.5 - centroid["y"] / image_height) * height_m
        heading = math.radians(telemetry.get("heading_deg", 0))
        # camera x is right of heading, camera y is forward; rotate to EN.
        e = east_m * math.cos(heading) + north_m * math.sin(heading)
        n = -east_m * math.sin(heading) + north_m * math.cos(heading)
        latitude = telemetry["lat"] + n / EARTH_RADIUS_M * 180 / pi
        longitude = telemetry["lon"] + e / (EARTH_RADIUS_M * cos(telemetry["lat"] * pi / 180)) * 180 / pi
        # Conservative operational estimate: half a pixel footprint plus GNSS.
        error_m = round(((width_m / image_width) ** 2 + 3.0 ** 2) ** .5, 2)
        return {"detection_id": detection["detection_id"], "latitude": round(latitude, 7), "longitude": round(longitude, 7), "error_m": error_m, "method": "flat_ground_photogrammetric"}
