"""Config-driven PX4 startup mission; deliberately not reachable from Socket.IO."""

from __future__ import annotations

from typing import Any

from mavsdk.mission import MissionItem, MissionPlan


def build_mission_plan(waypoints: list[dict[str, float]], takeoff_altitude_m: float) -> MissionPlan:
    """Build a plan from this instance's explicit configured route."""
    items = [
        MissionItem(
            waypoint["lat"], waypoint["lon"], waypoint["alt_m"], 5.0, True,
            -90.0, float("nan"), MissionItem.CameraAction.NONE, float("nan"),
            float("nan"), float("nan"), float("nan"), float("nan"),
            MissionItem.VehicleAction.NONE,
        )
        for waypoint in waypoints
    ]
    return MissionPlan(items)


async def arm_takeoff_and_start_mission(drone: Any, config: dict[str, Any]) -> None:
    """Perform the operator-configured SITL lifecycle after healthy GPS is available.

    This module is imported only by process startup. CommandHandler never imports it,
    preventing dashboard input from reaching arm, takeoff, or mission-upload calls.
    """
    async for health in drone.telemetry.health():
        if health.is_global_position_ok and health.is_home_position_ok:
            break

    altitude = float(config["takeoff_altitude_m"])
    await drone.action.set_takeoff_altitude(altitude)
    await drone.action.arm()
    await drone.action.takeoff()

    # PX4/SITL startup timing varies; wait on real altitude rather than sleeping.
    async for position in drone.telemetry.position():
        if position.relative_altitude_m >= altitude * 0.95:
            break

    await drone.mission.upload_mission(build_mission_plan(config["waypoints"], altitude))
    await drone.mission.start_mission()
