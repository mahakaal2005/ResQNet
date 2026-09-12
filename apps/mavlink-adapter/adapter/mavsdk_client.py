"""Thin MAVSDK connection wrapper; no dashboard command can arm or take off."""

from __future__ import annotations

import logging

from mavsdk import System

LOG = logging.getLogger(__name__)


class MavsdkClient:
    def __init__(self, system_address: str = "udp://:14540") -> None:
        self.system_address = system_address
        self.drone = System()

    async def connect(self) -> None:
        LOG.info("connecting to PX4 SITL at %s", self.system_address)
        await self.drone.connect(system_address=self.system_address)
        async for state in self.drone.core.connection_state():
            if state.is_connected:
                LOG.info("PX4 SITL connected")
                return
