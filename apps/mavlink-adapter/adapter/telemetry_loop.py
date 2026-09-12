"""Combine independently-updating MAVSDK streams into one 1 Hz packet."""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from .schema_validator import TelemetryValidator

LOG = logging.getLogger(__name__)


class TelemetryLoop:
    def __init__(self, drone: Any, validator: TelemetryValidator, emit: Callable[[dict[str, Any]], Awaitable[None]],
                 drone_id: str, sector_id: str, frame_ref: str = "mavsdk:no-camera") -> None:
        self.drone, self.validator, self.emit = drone, validator, emit
        self.drone_id, self.sector_id, self.frame_ref = drone_id, sector_id, frame_ref
        self.latest: dict[str, Any] = {}

    async def run(self, mission_running: Callable[[], bool]) -> None:
        consumers = [
            self._consume_position(), self._consume_attitude(), self._consume_battery(),
            self._consume_flight_mode(), self._consume_armed(), self._consume_gps(),
        ]
        tasks = [asyncio.create_task(consumer) for consumer in consumers]
        try:
            while True:
                if mission_running():
                    await self._emit_current()
                await asyncio.sleep(1)
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _consume_position(self) -> None:
        async for position in self.drone.telemetry.position():
            # Do not fabricate a location when PX4 reports an invalid GPS sample.
            if math.isfinite(position.latitude_deg) and math.isfinite(position.longitude_deg):
                self.latest.update(lat=position.latitude_deg, lon=position.longitude_deg,
                                   altitude_m=max(0.0, position.relative_altitude_m))

    async def _consume_attitude(self) -> None:
        async for attitude in self.drone.telemetry.attitude_euler():
            self.latest["heading_deg"] = attitude.yaw_deg % 360

    async def _consume_battery(self) -> None:
        async for battery in self.drone.telemetry.battery():
            self.latest["battery_pct"] = max(0.0, min(100.0, battery.remaining_percent * 100))

    async def _consume_flight_mode(self) -> None:
        async for mode in self.drone.telemetry.flight_mode():
            self.latest["flight_mode"] = str(mode)

    async def _consume_armed(self) -> None:
        async for armed in self.drone.telemetry.armed():
            self.latest["armed"] = bool(armed)

    async def _consume_gps(self) -> None:
        async for gps in self.drone.telemetry.gps_info():
            # MAVSDK FixType values >= FIX_2D are usable positional fixes.
            self.latest["gps_healthy"] = int(gps.fix_type) >= 3

    async def _emit_current(self) -> None:
        required = {"lat", "lon", "altitude_m", "heading_deg"}
        if not required.issubset(self.latest):
            LOG.debug("waiting for initial MAVSDK telemetry: missing %s", required - self.latest.keys())
            return
        packet = {
            "drone_id": self.drone_id, "sector_id": self.sector_id,
            "timestamp": datetime.now(timezone.utc).isoformat(), **self.latest,
            # No camera is integrated in this milestone. This remains a pointer,
            # never image data, and can be replaced by a camera adapter later.
            "gimbal_pitch_deg": -90.0, "frame_ref": self.frame_ref,
        }
        errors = self.validator.errors(packet)
        if errors:
            LOG.warning("dropping invalid telemetry packet: %s", "; ".join(errors))
            return
        await self.emit(packet)
