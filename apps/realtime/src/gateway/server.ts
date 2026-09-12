import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { validateTelemetry } from "./telemetryValidator";
import { DroneStateMachine } from "../drone-state/stateMachine";
import { scheduleMockMissionStart, MissionEvent } from "../drone-state/missionState";

type CommandType = "pause" | "resume" | "return_home";
interface DroneCommand { command_id: string; drone_id: string; type: CommandType; issued_by: string; issued_at: string; }
interface DroneRegistration { drone_id: string; device_token: string; }
interface TelemetryPacket {
  drone_id: string;
  sector_id: string;
  timestamp: string;
}
interface TelemetryReplay { drone_id: string; records: unknown[]; }
interface DetectionEvent {
  detection_id: string;
  drone_id: string;
  sector_id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  confidence: number;
  bbox: { x: number; y: number; w: number; h: number };
  frame_ref?: string;
  status?: "new" | "confirmed" | "rescued" | "false_positive";
}

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
  // The gateway is deliberately the short-lived operational cache. It lets a
  // newly opened dashboard render the last known positions without inventing
  // client-side coordinates; the database remains the incident system of record.
  const latestTelemetry = new Map<string, unknown>();
  const latestDetections = new Map<string, DetectionEvent>();
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
    socket.emit("drone.sync", {
      drones: [...latestTelemetry.values()],
      detections: [...latestDetections.values()],
      at: new Date().toISOString(),
    });

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
      ingestTelemetry(packet, socket.id);
    });

    socket.on("detection.created", (event: unknown) => {
      if (!isDetectionEvent(event) || !socketDrones.get(socket.id)?.has(event.drone_id)) {
        return void socket.emit("detection.rejected", { reason: "invalid_detection" });
      }
      latestDetections.set(event.detection_id, event);
      realtime.emit("detection.created", event);
    });

    socket.on("telemetry.replay", (replay: unknown) => {
      if (!isTelemetryReplay(replay)) return void socket.emit("telemetry.rejected", { reason: "invalid_replay" });
      if (!socketDrones.get(socket.id)?.has(replay.drone_id)) {
        return void socket.emit("telemetry.rejected", { reason: "unregistered_drone" });
      }

      const before = stateMachine.get(replay.drone_id);
      const firstTimestamp = replay.records.length > 0 ? getTimestamp(replay.records[0]) : undefined;
      let accepted = 0;
      let lastTimestamp: string | undefined;
      for (const packet of replay.records) {
        if (!isTelemetryForDrone(packet, replay.drone_id)) {
          socket.emit("telemetry.rejected", { reason: "invalid_replay_record" });
          continue;
        }
        if (ingestTelemetry(packet, socket.id, true)) {
          accepted += 1;
          lastTimestamp = packet.timestamp;
        }
      }

      if (accepted > 0 && before?.status === "lost") {
        const now = new Date().toISOString();
        realtime.emit("network.reconnected", { drone_id: replay.drone_id, at: now });
        realtime.emit("sync.completed", {
          drone_id: replay.drone_id,
          records_flushed: accepted,
          from: firstTimestamp ?? new Date(before.lastSeenMs).toISOString(),
          to: lastTimestamp ?? now,
        });
      }
    });

    // Charan's mission service can publish these events directly once live.
    // The local mock uses the same transport path, so the simulator contract stays unchanged.
    socket.on("mission.started", (event: unknown) => {
      if (isMissionEvent(event, "mission.started")) realtime.emit("mission.started", event);
    });
    socket.on("mission.paused", (event: unknown) => {
      if (isMissionEvent(event, "mission.paused")) realtime.emit("mission.paused", event);
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

    // WebRTC media never traverses the gateway.  It only relays SDP/ICE
    // envelopes between the command console and a browser-based simulated
    // survivor endpoint.  Keeping this opaque avoids coupling Socket.IO to a
    // particular browser/WebRTC implementation.
    socket.on("voice.signal", (signal: unknown) => {
      if (!isVoiceSignal(signal)) return void socket.emit("voice.signal.rejected", { reason: "invalid_signal" });
      socket.broadcast.emit("voice.signal", signal);
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

  function ingestTelemetry(packet: unknown, socketId: string, suppressReconnectEvents = false): boolean {
    const result = validateTelemetry(packet);
    if (!result.valid) {
      realtime.to(socketId).emit("telemetry.rejected", { reason: "invalid", errors: result.errors });
      return false;
    }
    const p = packet as TelemetryPacket;
    if (!socketDrones.get(socketId)?.has(p.drone_id)) {
      realtime.to(socketId).emit("telemetry.rejected", { reason: "unregistered_drone" });
      return false;
    }
    const timestampMs = Date.parse(p.timestamp);
    const previous = lastTelemetryMs.get(p.drone_id);
    if (previous !== undefined && timestampMs <= previous) {
      realtime.to(socketId).emit("telemetry.rejected", { reason: timestampMs === previous ? "duplicate" : "stale" });
      return false;
    }
    lastTelemetryMs.set(p.drone_id, timestampMs);
    latestTelemetry.set(p.drone_id, packet);
    const nowMs = Date.now();
    const previousState = stateMachine.get(p.drone_id);
    const statusEvent = stateMachine.onTelemetry(p.drone_id, p.sector_id, nowMs);
    realtime.emit("drone.telemetry", packet);
    if (statusEvent) realtime.emit("drone.status", statusEvent);
    if (!suppressReconnectEvents && statusEvent?.status === "reconnected" && previousState?.status === "lost") {
      realtime.emit("network.reconnected", { drone_id: p.drone_id, at: new Date(nowMs).toISOString() });
      realtime.emit("sync.completed", {
        drone_id: p.drone_id,
        records_flushed: 0,
        from: new Date(previousState.lastSeenMs).toISOString(),
        to: new Date(nowMs).toISOString(),
      });
    }
    return true;
  }
}

function isDetectionEvent(value: unknown): value is DetectionEvent {
  if (!isObject(value)) return false;
  const bbox = value.bbox;
  return typeof value.detection_id === "string" && value.detection_id.length > 0
    && typeof value.drone_id === "string" && typeof value.sector_id === "string"
    && typeof value.timestamp === "string" && !Number.isNaN(Date.parse(value.timestamp))
    && typeof value.latitude === "number" && Number.isFinite(value.latitude)
    && typeof value.longitude === "number" && Number.isFinite(value.longitude)
    && typeof value.confidence === "number" && value.confidence >= 0 && value.confidence <= 1
    && isObject(bbox) && [bbox.x, bbox.y, bbox.w, bbox.h].every(n => typeof n === "number" && Number.isFinite(n));
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
function isTelemetryReplay(value: unknown): value is TelemetryReplay {
  return isObject(value) && typeof value.drone_id === "string" && Array.isArray(value.records);
}
function isTelemetryForDrone(value: unknown, droneId: string): value is TelemetryPacket {
  return isObject(value) && value.drone_id === droneId && validateTelemetry(value).valid;
}
function getTimestamp(value: unknown): string | undefined {
  return isObject(value) && typeof value.timestamp === "string" ? value.timestamp : undefined;
}
function isMissionEvent(value: unknown, event: "mission.started" | "mission.paused"): value is { mission_id: string; status: string } {
  return isObject(value) && typeof value.mission_id === "string" && typeof value.status === "string" && event.length > 0;
}
function isVoiceSignal(value: unknown): value is { type: "offer" | "answer" | "ice" | "hangup"; call_id: string; payload?: unknown } {
  return isObject(value) && typeof value.call_id === "string" && value.call_id.length > 0
    && (value.type === "offer" || value.type === "answer" || value.type === "ice" || value.type === "hangup");
}
function isObject(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
