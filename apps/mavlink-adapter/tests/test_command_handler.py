import pytest

from adapter.command_handler import CommandHandler


class Action:
    def __init__(self): self.calls = []
    async def hold(self): self.calls.append("hold")
    async def return_to_launch(self): self.calls.append("return_to_launch")


class Mission:
    def __init__(self): self.calls = []
    async def start_mission(self): self.calls.append("start_mission")


class Drone:
    def __init__(self):
        self.action = Action()
        self.mission = Mission()


@pytest.mark.asyncio
@pytest.mark.parametrize("command_type", ["arm", "Arm", "ARM", "take_off", "takeoff", "mission_upload", "pause "])
async def test_near_miss_commands_are_rejected_without_mavsdk_dispatch(command_type):
    acknowledgements = []

    async def emit_ack(ack): acknowledgements.append(ack)

    await CommandHandler(Drone(), emit_ack).handle({"command_id": "cmd-1", "drone_id": "DRONE-04", "type": command_type})
    assert acknowledgements[0]["status"] == "rejected"
    assert acknowledgements[0]["reason"] == "command_not_allowed"


@pytest.mark.asyncio
@pytest.mark.parametrize("command_type,expected", [("pause", "hold"), ("resume", "start_mission"), ("return_home", "return_to_launch")])
async def test_allowlisted_commands_call_only_the_mapped_mavsdk_action(command_type, expected):
    acknowledgements, drone = [], Drone()

    async def emit_ack(ack): acknowledgements.append(ack)

    await CommandHandler(drone, emit_ack).handle({"command_id": "cmd-1", "drone_id": "DRONE-04", "type": command_type})
    assert expected in drone.action.calls + drone.mission.calls
    assert acknowledgements[0]["status"] == "accepted"
