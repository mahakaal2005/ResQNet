import { io } from "socket.io-client";
import { DroneAgent } from "./droneAgent";
import { SECTORS } from "./sectors";
import dotenv from 'dotenv';

dotenv.config()

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:4000";
const DEVICE_TOKEN = process.env.DRONE_DEVICE_TOKEN ?? "simulator-development-token";
const TICK_MS = 1000; // 1Hz, matches the "~1-2Hz" contract note in Section 10.6

// DRONE-01/02/03 -> SECTOR-A/B/C. Mirrors generateFixtures.ts so live mode
// and the frozen fixture describe the same demo scenario.
const agents = [
  new DroneAgent("DRONE-01", SECTORS[0]),
  new DroneAgent("DRONE-02", SECTORS[1]),
  new DroneAgent("DRONE-03", SECTORS[2]),
];

let frameCounter = 1;
let running = false; // gated by mission.started / mission.paused

function main() {
  console.log(`[simulator] connecting to ${GATEWAY_URL}/realtime ...`);
  const socket = io(`${GATEWAY_URL}/realtime`, { transports: ["websocket"] });

  socket.on("connect", () => {
    console.log(`[simulator] connected as ${socket.id}`);
    for (const agent of agents) {
      socket.emit("drone.register", { drone_id: agent.droneId, device_token: DEVICE_TOKEN });
    }
  });

  // Consumed from Charan (mocked locally with a static event until the real
  // mission API is live — this is exactly the pattern Section 23 requires).
  socket.on("mission.started", () => {
    running = true;
    console.log("[simulator] mission.started -> drones moving");
  });
  socket.on("mission.paused", () => {
    running = false;
    console.log("[simulator] mission.paused -> drones holding");
  });

  socket.on("disconnect", (reason) => {
    console.log(`[simulator] disconnected: ${reason}`);
  });

  socket.on("drone.command", (command: unknown) => {
    if (!isDroneCommand(command) || !agents.some((agent) => agent.droneId === command.drone_id)) return;
    if (command.type === "pause" || command.type === "return_home") running = false;
    if (command.type === "resume") running = true;
    socket.emit("drone.command.ack", {
      command_id: command.command_id,
      drone_id: command.drone_id,
      status: command.type === "return_home" ? "accepted" : "completed",
      at: new Date().toISOString(),
    });
  });

  setInterval(() => {
    if (!running) return;
    for (const agent of agents) {
      const packet = agent.next(frameCounter);
      frameCounter++;
      socket.emit("telemetry", packet);
    }
  }, TICK_MS);

  // Standalone demo convenience: if nobody sends mission.started within 2s
  // (e.g. Charan's API isn't running yet), start anyway so `npm run dev` in
  // this app alone is still a complete independent demo.
  setTimeout(() => {
    if (!running) {
      console.log("[simulator] no mission.started received — starting locally (standalone demo mode)");
      running = true;
    }
  }, 2000);
}

main();

function isDroneCommand(value: unknown): value is { command_id: string; drone_id: string; type: "pause" | "resume" | "return_home" } {
  return typeof value === "object" && value !== null
    && typeof (value as Record<string, unknown>).command_id === "string"
    && typeof (value as Record<string, unknown>).drone_id === "string"
    && ["pause", "resume", "return_home"].includes((value as Record<string, unknown>).type as string);
}
