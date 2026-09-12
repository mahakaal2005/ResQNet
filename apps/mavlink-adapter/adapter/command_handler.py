"""Strict command allowlist for the simulation-only adapter."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

ALLOWED_COMMANDS = frozenset({"pause", "resume", "return_home"})


class CommandHandler:
    def __init__(self, drone: Any, emit_ack: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        self._drone = drone
        self._emit_ack = emit_ack

    async def handle(self, command: Any) -> None:
        command_id = command.get("command_id") if isinstance(command, dict) else None
        drone_id = command.get("drone_id") if isinstance(command, dict) else None
        command_type = command.get("type") if isinstance(command, dict) else None
        ack: dict[str, Any] = {
            "command_id": command_id if isinstance(command_id, str) else "",
            "drone_id": drone_id if isinstance(drone_id, str) else "",
            "at": datetime.now(timezone.utc).isoformat(),
        }

        # Exact, case-sensitive matching is deliberate. Never add arm, takeoff,
        # mission upload, or a generic action dispatcher here.
        if command_type not in ALLOWED_COMMANDS:
            ack.update(status="rejected", reason="command_not_allowed")
            await self._emit_ack(ack)
            return

        try:
            if command_type == "pause":
                await self._drone.action.hold()
            elif command_type == "resume":
                await self._drone.mission.start_mission()
            else:  # return_home
                await self._drone.action.return_to_launch()
        except Exception as error:  # MAVSDK result failures must reach the console.
            ack.update(status="rejected", reason=f"mavsdk_action_failed: {error}")
        else:
            ack.update(status="accepted")
        await self._emit_ack(ack)
