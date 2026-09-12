from adapter.schema_validator import TelemetryValidator


def test_extended_contract_accepts_all_optional_mavlink_fields():
    packet = {
        "drone_id": "DRONE-04", "sector_id": "SECTOR-D", "timestamp": "2026-01-01T00:00:00Z",
        "lat": 12.9716, "lon": 77.5946, "altitude_m": 10.0, "heading_deg": 90.0,
        "gimbal_pitch_deg": -90.0, "frame_ref": "mavsdk:no-camera",
        "battery_pct": 91.5, "armed": False, "flight_mode": "HOLD", "gps_healthy": True,
    }
    assert TelemetryValidator().is_valid(packet)


def test_validator_rejects_unrecognised_properties():
    packet = {
        "drone_id": "DRONE-04", "sector_id": "SECTOR-D", "timestamp": "2026-01-01T00:00:00Z",
        "lat": 12.9716, "lon": 77.5946, "altitude_m": 10.0, "heading_deg": 90.0,
        "gimbal_pitch_deg": -90.0, "frame_ref": "mavsdk:no-camera", "unsafe": True,
    }
    assert not TelemetryValidator().is_valid(packet)
