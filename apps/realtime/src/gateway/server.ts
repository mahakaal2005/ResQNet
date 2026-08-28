import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { validateTelemetry } from "./telemetryValidator";
import { DroneStateMachine } from "../drone-state/stateMachine";
import { scheduleMockMissionStart, MissionEvent } from "../drone-state/missionState";

export interface GatewayOptions {
  port?: number;
  lostAfterMs?: number;
  /** When true, auto-emits a mocked mission.started shortly after a client connects. */
  mockMission?: boolean;
}

export function createGateway(opts: GatewayOptions = {}) {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, { cors: { origin: "*" } });

  const stateMachine = new DroneStateMachine(opts.lostAfterMs ?? 5000);

  app.get("/realtime/health", (_req, res) => {
    res.json({ status: "ok", service: "realtime-gateway" });
  });

  const realtime = io.of("/realtime");

  realtime.on("connection", (socket) => {
    console.log(`[gateway] client connected: ${socket.id}`);

    if (opts.mockMission ?? true) {
      scheduleMockMissionStart((event: MissionEvent) => {
        socket.emit(event, { mission_id: "MISSION-DEMO-1", status: event === "mission.started" ? "active" : "paused" });
        realtime.emit(event, { mission_id: "MISSION-DEMO-1", status: event === "mission.started" ? "active" : "paused" });
      });
    }

    socket.on("telemetry", (packet: unknown) => {
      const result = validateTelemetry(packet);
      if (!result.valid) {
        console.warn(`[gateway] rejected malformed telemetry from ${socket.id}:`, result.errors);
        socket.emit("telemetry.rejected", { errors: result.errors });
        return;
      }

      const p = packet as { drone_id: string; sector_id: string };
      const statusEvent = stateMachine.onTelemetry(p.drone_id, p.sector_id);

      // Broadcast to every connected dashboard client (and anyone else listening).
      realtime.emit("drone.telemetry", packet);
      if (statusEvent) {
        realtime.emit("drone.status", statusEvent);
      }
    });

    socket.on("disconnect", () => {
      console.log(`[gateway] client disconnected: ${socket.id}`);
    });
  });

  // Sweep for drones that have gone quiet, independent of any single socket.
  const sweepInterval = setInterval(() => {
    const lostEvents = stateMachine.tick();
    for (const evt of lostEvents) {
      realtime.emit("drone.status", evt);
      realtime.emit("network.offline", { drone_id: evt.drone_id, since: evt.last_seen });
    }
  }, 1000);

  function close() {
    clearInterval(sweepInterval);
    io.close();
    httpServer.close();
  }

  return { app, httpServer, io, stateMachine, close };
}
