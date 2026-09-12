import json
from pathlib import Path


CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


def test_four_configs_have_unique_identity_port_and_explicit_routes():
    configs = [json.loads((CONFIG_DIR / f"drone-0{number}.json").read_text(encoding="utf-8")) for number in range(1, 5)]
    assert {config["drone_id"] for config in configs} == {f"DRONE-0{number}" for number in range(1, 5)}
    assert {config["mavlink_port"] for config in configs} == {14540, 14541, 14542, 14543}
    assert len({json.dumps(config["waypoints"], sort_keys=True) for config in configs}) == 4
    assert all(config["waypoints"] and config["sector_id"] == f"SECTOR-{chr(64 + index)}" for index, config in enumerate(configs, 1))
