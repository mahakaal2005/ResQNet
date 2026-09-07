import { io as createClient, Socket } from "socket.io-client";
import { createGateway } from "../src/gateway/server";
import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";

const telemetry = (droneId = "DRONE-01", timestamp = "2026-08-27T10:30:00.000Z") => ({
  drone_id: droneId, sector_id: `SECTOR-${droneId === "DRONE-02" ? "B" : droneId === "DRONE-03" ? "C" : "A"}`,
  timestamp, lat: 28.6139, lon: 77.209, altitude_m: 80, heading_deg: 135, gimbal_pitch_deg: -90, frame_ref: "frame_00001.jpg",
});

describe("realtime gateway", () => {
  let gateway: ReturnType<typeof createGateway>;
  let url: string;
  const clients: Socket[] = [];

  beforeEach(async () => {
    gateway = createGateway({ mockMission: false });
    await new Promise<void>((resolve) => gateway.httpServer.listen(0, "127.0.0.1", resolve));
    const address = gateway.httpServer.address();
    if (!address || typeof address === "string") throw new Error("Gateway did not bind to a port");
    url = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    clients.forEach((client) => client.disconnect());
    await gateway.close();
  });

  function client() {
    const socket = createClient(`${url}/realtime`, { transports: ["websocket"], forceNew: true });
    clients.push(socket);
    return socket;
  }

  function once<T>(socket: Socket, event: string, timeout = 1500): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
      socket.once(event, (value: T) => { clearTimeout(timer); resolve(value); });
    });
  }

  async function connected(socket: Socket) { await once<void>(socket, "connect"); }
  async function register(socket: Socket, droneId: string) {
    const registered = once<{ drone_id: string }>(socket, "drone.registered");
    socket.emit("drone.register", { drone_id: droneId, device_token: "test-device-token" });
    await expect(registered).resolves.toMatchObject({ drone_id: droneId });
  }

  test("valid registered telemetry is broadcast with a connected state", async () => {
    const drone = client(); const observer = client();
    await Promise.all([connected(drone), connected(observer)]);
    await register(drone, "DRONE-01");
    const telemetryEvent = once<ReturnType<typeof telemetry>>(observer, "drone.telemetry");
    const statusEvent = once<{ drone_id: string; status: string }>(observer, "drone.status");
    const packet = telemetry(); drone.emit("telemetry", packet);
    await expect(telemetryEvent).resolves.toEqual(packet);
    await expect(statusEvent).resolves.toMatchObject({ drone_id: "DRONE-01", status: "connected" });
  });

  test("malformed telemetry is rejected and never broadcast", async () => {
    const drone = client(); const observer = client();
    await Promise.all([connected(drone), connected(observer)]);
    await register(drone, "DRONE-01");
    const rejected = once<{ reason: string }>(drone, "telemetry.rejected");
    let broadcast = false; observer.once("drone.telemetry", () => { broadcast = true; });
    drone.emit("telemetry", { ...telemetry(), altitude_m: undefined });
    await expect(rejected).resolves.toMatchObject({ reason: "invalid" });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(broadcast).toBe(false);
  });

  test("duplicate and stale telemetry are rejected without another broadcast", async () => {
    const drone = client(); const observer = client();
    await Promise.all([connected(drone), connected(observer)]); await register(drone, "DRONE-01");
    const first = telemetry(); const firstEvent = once(observer, "drone.telemetry"); drone.emit("telemetry", first); await firstEvent;
    const duplicate = once<{ reason: string }>(drone, "telemetry.rejected"); drone.emit("telemetry", first);
    await expect(duplicate).resolves.toMatchObject({ reason: "duplicate" });
    const stale = once<{ reason: string }>(drone, "telemetry.rejected"); drone.emit("telemetry", telemetry("DRONE-01", "2026-08-27T10:29:59.000Z"));
    await expect(stale).resolves.toMatchObject({ reason: "stale" });
  });

  test("a silent drone becomes lost then reconnects", async () => {
    await gateway.close();
    gateway = createGateway({ mockMission: false, lostAfterMs: 40 });
    await new Promise<void>((resolve) => gateway.httpServer.listen(0, "127.0.0.1", resolve));
    const address = gateway.httpServer.address(); if (!address || typeof address === "string") throw new Error("Gateway did not bind");
    url = `http://127.0.0.1:${address.port}`;
    const drone = client(); const observer = client();
    await Promise.all([connected(drone), connected(observer)]); await register(drone, "DRONE-01");
    const firstTelemetry = once(observer, "drone.telemetry");
    drone.emit("telemetry", telemetry()); await firstTelemetry;
    const lost = once<{ status: string; drone_id: string }>(observer, "drone.status");
    const offline = once<{ drone_id: string }>(observer, "network.offline");
    await expect(lost).resolves.toMatchObject({ drone_id: "DRONE-01", status: "lost" });
    await expect(offline).resolves.toMatchObject({ drone_id: "DRONE-01" });
    const reconnected = once<{ status: string }>(observer, "drone.status");
    drone.emit("telemetry", telemetry("DRONE-01", "2026-08-27T10:30:01.000Z"));
    await expect(reconnected).resolves.toMatchObject({ status: "reconnected" });
  });

  test("tracks multiple drones independently", async () => {
    await gateway.close();
    gateway = createGateway({ mockMission: false, lostAfterMs: 60 });
    await new Promise<void>((resolve) => gateway.httpServer.listen(0, "127.0.0.1", resolve));
    const address = gateway.httpServer.address(); if (!address || typeof address === "string") throw new Error("Gateway did not bind");
    url = `http://127.0.0.1:${address.port}`;
    const one = client(); const two = client(); const three = client(); const observer = client();
    await Promise.all([connected(one), connected(two), connected(three), connected(observer)]);
    await register(one, "DRONE-01"); await register(two, "DRONE-02"); await register(three, "DRONE-03");
    const received = [once(observer, "drone.telemetry"), once(observer, "drone.telemetry"), once(observer, "drone.telemetry")];
    one.emit("telemetry", telemetry("DRONE-01", "2026-08-27T10:30:00.000Z"));
    two.emit("telemetry", telemetry("DRONE-02", "2026-08-27T10:30:00.000Z"));
    three.emit("telemetry", telemetry("DRONE-03", "2026-08-27T10:30:00.000Z"));
    await Promise.all(received);
    const keepAlive = setInterval(() => {
      const timestamp = new Date(Date.now() + 60_000).toISOString();
      two.emit("telemetry", telemetry("DRONE-02", timestamp));
      three.emit("telemetry", telemetry("DRONE-03", timestamp));
    }, 20);
    const lost = once<{ drone_id: string; status: string }>(observer, "drone.status");
    await expect(lost).resolves.toMatchObject({ drone_id: "DRONE-01", status: "lost" });
    clearInterval(keepAlive);
    expect(gateway.stateMachine.get("DRONE-02")?.status).toBe("connected");
    expect(gateway.stateMachine.get("DRONE-03")?.status).toBe("connected");
  });

  test("the mocked mission starts once even when several clients connect", async () => {
    await gateway.close();
    gateway = createGateway({ mockMission: true });
    await new Promise<void>((resolve) => gateway.httpServer.listen(0, "127.0.0.1", resolve));
    const address = gateway.httpServer.address(); if (!address || typeof address === "string") throw new Error("Gateway did not bind");
    url = `http://127.0.0.1:${address.port}`;
    const first = client(); const second = client();
    await Promise.all([connected(first), connected(second)]);
    let starts = 0; first.on("mission.started", () => { starts += 1; });
    await new Promise((resolve) => setTimeout(resolve, 650));
    expect(starts).toBe(1);
  });

  test("routes a command only to its registered drone and relays its acknowledgement", async () => {
    const droneOne = client(); const droneTwo = client(); const operator = client(); const observer = client();
    await Promise.all([connected(droneOne), connected(droneTwo), connected(operator), connected(observer)]);
    await register(droneOne, "DRONE-01"); await register(droneTwo, "DRONE-02");
    const command = { command_id: "cmd-1", drone_id: "DRONE-01", type: "pause", issued_by: "operator-1", issued_at: new Date().toISOString() };
    const delivered = once<typeof command>(droneOne, "drone.command");
    let wrongDroneReceived = false; droneTwo.once("drone.command", () => { wrongDroneReceived = true; });
    operator.emit("drone.command", command);
    await expect(delivered).resolves.toEqual(command); expect(wrongDroneReceived).toBe(false);
    const acknowledgement = once<{ command_id: string; status: string }>(observer, "drone.command.ack");
    droneOne.emit("drone.command.ack", { command_id: "cmd-1", drone_id: "DRONE-01", status: "completed", at: new Date().toISOString() });
    await expect(acknowledgement).resolves.toMatchObject({ command_id: "cmd-1", status: "completed" });
  });

  test("rejects malformed commands and commands for offline drones", async () => {
    const operator = client(); await connected(operator);
    const invalid = once<{ reason: string }>(operator, "drone.command.rejected"); operator.emit("drone.command", {});
    await expect(invalid).resolves.toMatchObject({ reason: "invalid_command" });
    const offline = once<{ reason: string }>(operator, "drone.command.rejected");
    operator.emit("drone.command", { command_id: "cmd-2", drone_id: "DRONE-99", type: "pause", issued_by: "operator-1", issued_at: new Date().toISOString() });
    await expect(offline).resolves.toMatchObject({ reason: "drone_offline" });
  });
});
