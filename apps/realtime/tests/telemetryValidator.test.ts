import { describe, expect, it } from "@jest/globals";
import { validateTelemetry } from "../src/gateway/telemetryValidator";

const VALID_PACKET = {
  drone_id: "DRONE-01",
  sector_id: "SECTOR-A",
  timestamp: "2026-08-27T10:30:00.000Z",
  lat: 28.6139,
  lon: 77.209,
  altitude_m: 80,
  heading_deg: 135,
  gimbal_pitch_deg: -90,
  frame_ref: "frame_00234.jpg",
};

describe("telemetry schema validation", () => {
  it("accepts a well-formed packet matching the frozen contract", () => {
    const result = validateTelemetry(VALID_PACKET);
    expect(result.valid).toBe(true);
  });

  it("rejects a packet missing a required field", () => {
    const { altitude_m, ...rest } = VALID_PACKET;
    const result = validateTelemetry(rest);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it("rejects out-of-range gimbal_pitch_deg (must be between -90 and 0)", () => {
    const result = validateTelemetry({ ...VALID_PACKET, gimbal_pitch_deg: 45 });
    expect(result.valid).toBe(false);
  });

  it("rejects an unknown extra field (additionalProperties: false)", () => {
    const result = validateTelemetry({ ...VALID_PACKET, extra_field: "not allowed" });
    expect(result.valid).toBe(false);
  });

  it("rejects a malformed drone_id (must match DRONE-NN)", () => {
    const result = validateTelemetry({ ...VALID_PACKET, drone_id: "drone-one" });
    expect(result.valid).toBe(false);
  });
});
