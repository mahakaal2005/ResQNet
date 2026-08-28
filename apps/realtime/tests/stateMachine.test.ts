import { DroneStateMachine } from "../src/drone-state/stateMachine";

describe("DroneStateMachine", () => {
  it("emits 'connected' the first time a drone is seen", () => {
    const sm = new DroneStateMachine(5000);
    const evt = sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    expect(evt).toEqual(
      expect.objectContaining({ drone_id: "DRONE-01", status: "connected", sector_id: "SECTOR-A" })
    );
  });

  it("emits no event on steady-state telemetry ticks", () => {
    const sm = new DroneStateMachine(5000);
    sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    const evt = sm.onTelemetry("DRONE-01", "SECTOR-A", 2000);
    expect(evt).toBeNull();
  });

  it("marks a drone 'lost' after the timeout with no telemetry", () => {
    const sm = new DroneStateMachine(5000);
    sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    const events = sm.tick(1000 + 5001);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(expect.objectContaining({ drone_id: "DRONE-01", status: "lost" }));
  });

  it("does not mark a drone lost before the timeout elapses", () => {
    const sm = new DroneStateMachine(5000);
    sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    const events = sm.tick(1000 + 4000);
    expect(events).toHaveLength(0);
  });

  it("emits 'reconnected' when telemetry resumes after being marked lost", () => {
    const sm = new DroneStateMachine(5000);
    sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    sm.tick(1000 + 5001); // goes lost
    const evt = sm.onTelemetry("DRONE-01", "SECTOR-A", 20000);
    expect(evt).toEqual(expect.objectContaining({ drone_id: "DRONE-01", status: "reconnected" }));
  });

  it("tracks multiple drones independently", () => {
    const sm = new DroneStateMachine(5000);
    sm.onTelemetry("DRONE-01", "SECTOR-A", 1000);
    sm.onTelemetry("DRONE-02", "SECTOR-B", 1000);
    const events = sm.tick(1000 + 5001);
    const droneIds = events.map((e) => e.drone_id).sort();
    expect(droneIds).toEqual(["DRONE-01", "DRONE-02"]);
  });
});
