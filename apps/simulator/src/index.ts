import { io } from "socket.io-client";
import { DroneAgent } from "./droneAgent";
import { SECTORS } from "./sectors";
import dotenv from 'dotenv';

dotenv.config()

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:4000";
const API_URL = process.env.API_URL ?? "http://localhost:3000";
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
let detectionSequence = 0;

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
      // This is a simulator-produced observation, not dashboard fixture data.
      // It follows the same detection + geolocation intake contract as the AI
      // service, so every demo marker can be traced to a concrete frame.
      if (frameCounter % 30 === 0) void publishDetection(socket, packet);
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

async function publishDetection(socket: ReturnType<typeof io>, packet: ReturnType<DroneAgent["next"]>) {
  const detectionId = `SIM-${packet.drone_id}-${++detectionSequence}`;
  const observation = {
    detection_id: detectionId,
    drone_id: packet.drone_id,
    sector_id: packet.sector_id,
    timestamp: packet.timestamp,
    // Camera geolocation in the simulator is derived from the current drone
    // telemetry; bbox remains image-space metadata for the feed overlay.
    latitude: packet.lat + 0.00018,
    longitude: packet.lon - 0.00012,
    confidence: 0.86,
    bbox: { x: 0.36, y: 0.31, w: 0.16, h: 0.28 },
    frame_ref: packet.frame_ref,
    status: "new" as const,
  };
  socket.emit("detection.created", observation);
  try {
    const detection = {
      detection_id: observation.detection_id, drone_id: observation.drone_id,
      sector_id: observation.sector_id, timestamp: observation.timestamp,
      bbox: observation.bbox, confidence: observation.confidence,
      centroid: { x: observation.bbox.x + observation.bbox.w / 2, y: observation.bbox.y + observation.bbox.h / 2 },
    };
    const first = await fetch(`${API_URL}/detections`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(detection) });
    if (!first.ok) throw new Error(`detection intake ${first.status}`);
    const second = await fetch(`${API_URL}/geolocations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ detection_id: observation.detection_id, latitude: observation.latitude, longitude: observation.longitude, error_m: 12, method: "simulated_camera_geolocation" }) });
    if (!second.ok) throw new Error(`geolocation intake ${second.status}`);
  } catch (error) {
    // The gateway event still proves the real-time path when the optional API
    // service is unavailable; retry happens on a new simulator observation.
    console.warn(`[simulator] ${detectionId} was not persisted: ${(error as Error).message}`);
  }
}

main();

function isDroneCommand(value: unknown): value is { command_id: string; drone_id: string; type: "pause" | "resume" | "return_home" } {
  return typeof value === "object" && value !== null
    && typeof (value as Record<string, unknown>).command_id === "string"
    && typeof (value as Record<string, unknown>).drone_id === "string"
    && ["pause", "resume", "return_home"].includes((value as Record<string, unknown>).type as string);
}
