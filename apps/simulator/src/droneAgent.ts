import { DroneTelemetry, SectorPolygon } from "./types";

/**
 * Generates a deterministic lawnmower-style scan path within a sector's
 * bounding box, plus telemetry at each tick. Deterministic (seeded by
 * drone_id) so fixtures are reproducible for AI (Faiqua/Atul) and CI.
 */
export class DroneAgent {
  readonly droneId: string;
  private sector: SectorPolygon;
  private tick = 0;
  private readonly ticksPerPass = 20;

  constructor(droneId: string, sector: SectorPolygon) {
    this.droneId = droneId;
    this.sector = sector;
  }

  /**
   * Advance one tick and return the telemetry packet for it.
   * @param frameCounter monotonically increasing frame index -> frame_ref
   * @param atTimestamp deterministic ISO timestamp for this tick (pass a
   *   fixed clock when generating reproducible fixtures; omit to use wall time)
   */
  next(frameCounter: number, atTimestamp?: string, atSector?: SectorPolygon): DroneTelemetry {
    const sector = atSector ?? this.sector;
    const [minLat, minLon, maxLat, maxLon] = sector.bounds;
    const passIndex = Math.floor(this.tick / this.ticksPerPass) % 2;
    const progress = (this.tick % this.ticksPerPass) / this.ticksPerPass;

    // Lawnmower: alternate direction each pass, sweep lon, step lat slightly.
    const lat = minLat + (maxLat - minLat) * (0.3 + 0.4 * progress);
    const lon = passIndex === 0
      ? minLon + (maxLon - minLon) * progress
      : maxLon - (maxLon - minLon) * progress;
    const heading = passIndex === 0 ? 90 : 270;

    this.tick += 1;

    return {
      drone_id: this.droneId,
      sector_id: sector.sector_id,
      timestamp: atTimestamp ?? new Date().toISOString(),
      lat: round(lat, 6),
      lon: round(lon, 6),
      altitude_m: 80,
      heading_deg: heading,
      gimbal_pitch_deg: -90,
      frame_ref: `frame_${String(frameCounter).padStart(5, "0")}.jpg`,
    };
  }
}

function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
