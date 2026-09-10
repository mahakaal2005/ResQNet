import { validateTelemetry } from "../apps/realtime/src/gateway/telemetryValidator";
import * as fs from "fs";
import * as path from "path";
const dataPath = path.join(__dirname, "..", "apps", "simulator", "sample_telemetry.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
let bad = 0;
for (const p of data) {
  const r = validateTelemetry(p);
  if (!r.valid) { bad++; console.log("INVALID", p, r.errors); }
}
console.log(`Checked ${data.length} packets against the frozen telemetry.schema.json, ${bad} invalid.`);
