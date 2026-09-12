"""Entrypoint for a single PX4 SITL drone adapter instance."""

from __future__ import annotations

import asyncio
import argparse
import json
import logging
from pathlib import Path

import socketio

from adapter.command_handler import CommandHandler
from adapter.autonomous_mission import arm_takeoff_and_start_mission
from adapter.mavsdk_client import MavsdkClient
from adapter.schema_validator import TelemetryValidator
from adapter.telemetry_loop import TelemetryLoop

LOG = logging.getLogger(__name__)


def load_config(path: str) -> dict:
    with Path(path).open(encoding="utf-8") as source:
        config = json.load(source)
    required = {"drone_id", "sector_id", "mavlink_port", "gateway_url", "takeoff_altitude_m", "waypoints"}
    missing = required - config.keys()
    if missing or not isinstance(config["waypoints"], list) or not config["waypoints"]:
        raise ValueError(f"invalid adapter config; missing/invalid fields: {sorted(missing)}")
    return config


async def run(config: dict) -> None:
    logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s %(message)s")
    # Config examples include /realtime; the Python client selects it as a namespace.
    gateway_url = str(config["gateway_url"]).removesuffix("/realtime")
    drone_id = config["drone_id"]
    sector_id = config["sector_id"]
    device_token = config.get("device_token", "mavlink-adapter-development-token")
    client = MavsdkClient(f"udp://:{int(config['mavlink_port'])}")
    socket = socketio.AsyncClient(reconnection=True)

    async def emit_ack(ack: dict) -> None:
        await socket.emit("drone.command.ack", ack)

    handler = CommandHandler(client.drone, emit_ack)

    @socket.event(namespace="/realtime")
    async def connect() -> None:
        LOG.info("connected to realtime gateway")
        await socket.emit("drone.register", {"drone_id": drone_id, "device_token": device_token}, namespace="/realtime")

    @socket.on("mission.started", namespace="/realtime")
    async def on_mission_started(_: object) -> None:
        # Autonomous mission startup is local/config-driven. The gateway event is
        # observed only for compatibility with the simulator transport contract.
        return None

    @socket.on("mission.paused", namespace="/realtime")
    async def on_mission_paused(_: object) -> None:
        return None

    @socket.on("drone.command", namespace="/realtime")
    async def on_command(command: object) -> None:
        if isinstance(command, dict) and command.get("drone_id") == drone_id:
            await handler.handle(command)

    await client.connect()
    await socket.connect(gateway_url, namespaces=["/realtime"], transports=["websocket"])
    # The sole call site for the privileged startup lifecycle. It is not exposed
    # to any gateway event handler.
    await arm_takeoff_and_start_mission(client.drone, config)
    telemetry = TelemetryLoop(client.drone, TelemetryValidator(),
                              lambda packet: socket.emit("telemetry", packet, namespace="/realtime"),
                              drone_id, sector_id)
    try:
        await telemetry.run(lambda: True)
    finally:
        await socket.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run one configured PX4 SITL adapter")
    parser.add_argument("config", help="path to one drone JSON config")
    asyncio.run(run(load_config(parser.parse_args().config)))
