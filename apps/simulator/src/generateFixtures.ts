import * as fs from "fs";
import * as path from "path";
import { DroneAgent } from "./droneAgent";
import { SECTORS, GROUND_TRUTH } from "./sectors";
import { DroneTelemetry } from "./types";

const TICKS_PER_DRONE = 40; // ~40s of flight per drone at 1Hz
const BASE_TIME = Date.parse("2026-08-27T10:30:00.000Z");

// DRONE-01 -> SECTOR-A, DRONE-02 -> SECTOR-B, DRONE-03 -> SECTOR-C
// (DRONE-03 re-covers the same synthetic survivor as DRONE-01, by design,
// so Rudra's dedup logic in fixtures has something real to merge.)
const agents = [
  new DroneAgent("DRONE-01", SECTORS[0]),
  new DroneAgent("DRONE-02", SECTORS[1]),
  new DroneAgent("DRONE-03", SECTORS[2]),
];

/** Generate the deterministic telemetry and matching image fixtures. */
export function generateFixtures(outDir = path.join(__dirname, "..")) {
  const telemetryOut = path.join(outDir, "sample_telemetry.json");
  const framesDir = path.join(outDir, "sample_frames");
  const groundTruthOut = path.join(outDir, "ground_truth.json");
  const telemetry: DroneTelemetry[] = [];
  let frameCounter = 1;

  for (let t = 0; t < TICKS_PER_DRONE; t++) {
    for (const agent of agents) {
      const ts = new Date(BASE_TIME + t * 1000).toISOString();
      telemetry.push(agent.next(frameCounter, ts));
      frameCounter++;
    }
  }

  fs.writeFileSync(telemetryOut, JSON.stringify(telemetry, null, 2));
  console.log(`Wrote ${telemetry.length} telemetry packets -> ${telemetryOut}`);

  fs.writeFileSync(groundTruthOut, JSON.stringify(GROUND_TRUTH, null, 2));
  console.log(`Wrote synthetic ground truth -> ${groundTruthOut}`);

  writeFramePlaceholders(framesDir, frameCounter - 1);
}

/**
 * Writes minimal valid 1x1 JPEG placeholder files for every frame_ref
 * referenced in the telemetry fixture, plus a manifest, so Faiqua's
 * detection service and Atul's geolocation service can point real file
 * I/O at real paths without waiting on real footage.
 */
function writeFramePlaceholders(framesDir: string, frameCount: number) {
  if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

  // Smallest valid JPEG (1x1 black pixel), base64-encoded.
  const TINY_JPEG_B64 =
    "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";
  const buf = Buffer.from(TINY_JPEG_B64, "base64");

  const manifest: { frame_ref: string; note: string }[] = [];
  for (let i = 1; i <= frameCount; i++) {
    const name = `frame_${String(i).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(framesDir, name), buf);
    manifest.push({ frame_ref: name, note: "placeholder — replace with real/composited aerial frame" });
  }
  fs.writeFileSync(path.join(framesDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Wrote ${manifest.length} placeholder frames -> ${framesDir}`);
}

if (require.main === module) {
  generateFixtures();
}
