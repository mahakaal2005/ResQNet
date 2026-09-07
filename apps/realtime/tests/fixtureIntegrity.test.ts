import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { generateFixtures } from "../../simulator/src/generateFixtures";

test("every generated telemetry frame_ref resolves to a generated frame", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "resqnet-fixtures-"));
  try {
    generateFixtures(outDir);
    const telemetry = JSON.parse(fs.readFileSync(path.join(outDir, "sample_telemetry.json"), "utf-8")) as Array<{ frame_ref: string }>;
    for (const packet of telemetry) expect(fs.existsSync(path.join(outDir, "sample_frames", packet.frame_ref))).toBe(true);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
