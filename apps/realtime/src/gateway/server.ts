import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { validateTelemetry } from "./telemetryValidator";
import { DroneStateMachine } from "../drone-state/stateMachine";
import { scheduleMockMissionStart, MissionEvent } from "../drone-state/missionState";

type CommandType = "pause" | "resume" | "return_home";
interface DroneCommand { command_id: string; drone_id: string; type: CommandType; issued_by: string; issued_at: string; }
interface DroneRegistration { drone_id: string; device_token: string; }

export interface GatewayOptions {
  port?: number;
  lostAfterMs?: number;
  /** When true, auto-emits one mocked mission.started event for the demo. */
  mockMission?: boolean;
  /** Telemetry carries metadata, never image bytes. */
  maxHttpBufferSize?: number;
}

export function createGateway(opts: GatewayOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" }, maxHttpBufferSize: opts.maxHttpBufferSize ?? 64 * 1024 });
  const stateMachine = new DroneStateMachine(opts.lostAfterMs ?? 5000);
  const droneSockets = new Map<string, string>();
  const socketDrones = new Map<string, Set<string>>();
  const lastTelemetryMs = new Map<string, number>();
  let missionStartScheduled = false;
  let missionTimer: NodeJS.Timeout | undefined;

  app.get("/realtime/health", (_req, res) => res.json({ status: "ok", service: "realtime-gateway" }));
  const realtime = io.of("/realtime");

  realtime.on("connection", (socket) => {
    console.log(`[gateway] client connected: ${socket.id}`);
    if ((opts.mockMission ?? true) && !missionStartScheduled) {
      missionStartScheduled = true;
      missionTimer = scheduleMockMissionStart((event: MissionEvent) => realtime.emit(event, {
        mission_id: "MISSION-DEMO-1", status: event === "mission.started" ? "active" : "paused",
      }));
    }

    socket.on("drone.register", (registration: unknown) => {
      if (!isDroneRegistration(registration)) return void socket.emit("drone.registration.rejected", { reason: "invalid_registration" });
      const droneId = registration.drone_id;
      const priorSocketId = droneSockets.get(droneId);
      if (priorSocketId && priorSocketId !== socket.id) socketDrones.get(priorSocketId)?.delete(droneId);
      droneSockets.set(droneId, socket.id);
      const drones = socketDrones.get(socket.id) ?? new Set<string>();
      drones.add(droneId);
      socketDrones.set(socket.id, drones);
      socket.emit("drone.registered", { drone_id: droneId, connected_at: new Date().toISOString() });
    });

    socket.on("telemetry", (packet: unknown) => {
      const result = validateTelemetry(packet);
      if (!result.valid) return void socket.emit("telemetry.rejected", { reason: "invalid", errors: result.errors });
      const p = packet as { drone_id: string; sector_id: string; timestamp: string };
      if (!socketDrones.get(socket.id)?.has(p.drone_id)) return void socket.emit("telemetry.rejected", { reason: "unregistered_drone" });
      const timestampMs = Date.parse(p.timestamp);
      const previous = lastTelemetryMs.get(p.drone_id);
      if (previous !== undefined && timestampMs <= previous) {
        return void socket.emit("telemetry.rejected", { reason: timestampMs === previous ? "duplicate" : "stale" });
      }
      lastTelemetryMs.set(p.drone_id, timestampMs);
      const statusEvent = stateMachine.onTelemetry(p.drone_id, p.sector_id);
      realtime.emit("drone.telemetry", packet);
      if (statusEvent) realtime.emit("drone.status", statusEvent);
    });

    socket.on("drone.command", (command: unknown) => {
      if (!isDroneCommand(command)) return void socket.emit("drone.command.rejected", { reason: "invalid_command" });
      const targetSocketId = droneSockets.get(command.drone_id);
      if (!targetSocketId) return void socket.emit("drone.command.rejected", {
        command_id: command.command_id, drone_id: command.drone_id, reason: "drone_offline",
      });
      realtime.to(targetSocketId).emit("drone.command", command);
    });

    socket.on("drone.command.ack", (ack: unknown) => {
      if (!isCommandAck(ack) || !socketDrones.get(socket.id)?.has(ack.drone_id)) {
        return void socket.emit("drone.command.ack.rejected", { reason: "invalid_ack" });
      }
      realtime.emit("drone.command.ack", ack);
    });

    socket.on("disconnect", () => {
      for (const droneId of socketDrones.get(socket.id) ?? []) if (droneSockets.get(droneId) === socket.id) droneSockets.delete(droneId);
      socketDrones.delete(socket.id);
      console.log(`[gateway] client disconnected: ${socket.id}`);
    });
  });

  const sweepInterval = setInterval(() => {
    for (const evt of stateMachine.tick()) {
      realtime.emit("drone.status", evt);
      realtime.emit("network.offline", { drone_id: evt.drone_id, since: evt.last_seen });
    }
  }, Math.min(1000, Math.max(10, Math.floor((opts.lostAfterMs ?? 5000) / 2))));

  async function close() {
    clearInterval(sweepInterval);
    if (missionTimer) clearTimeout(missionTimer);
    await new Promise<void>((resolve) => io.close(() => resolve()));
    if (httpServer.listening) await new Promise<void>((resolve, reject) => httpServer.close((error) => error ? reject(error) : resolve()));
  }
  return { app, httpServer, io, stateMachine, close };
}

function isDroneRegistration(value: unknown): value is DroneRegistration {
  return isObject(value) && typeof value.drone_id === "string" && /^DRONE-[0-9]{2}$/.test(value.drone_id)
    && typeof value.device_token === "string" && value.device_token.length > 0;
}
function isDroneCommand(value: unknown): value is DroneCommand {
  return isObject(value) && typeof value.command_id === "string" && value.command_id.length > 0
    && typeof value.drone_id === "string" && /^DRONE-[0-9]{2}$/.test(value.drone_id)
    && (value.type === "pause" || value.type === "resume" || value.type === "return_home")
    && typeof value.issued_by === "string" && value.issued_by.length > 0
    && typeof value.issued_at === "string" && !Number.isNaN(Date.parse(value.issued_at));
}
function isCommandAck(value: unknown): value is { command_id: string; drone_id: string; status: "accepted" | "completed" | "rejected"; at: string; reason?: string } {
  return isObject(value) && typeof value.command_id === "string" && typeof value.drone_id === "string"
    && (value.status === "accepted" || value.status === "completed" || value.status === "rejected")
    && typeof value.at === "string" && !Number.isNaN(Date.parse(value.at))
    && (value.reason === undefined || typeof value.reason === "string");
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
