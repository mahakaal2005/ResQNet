import { SectorPolygon, GroundTruthSurvivor } from "./types";

// Demo zone: a flood-plain area near Delhi, split into 3 rectangular sectors.
// These are intentionally simple boxes (not real polygons) — good enough for
// Phase 1 path generation and for Charan's mission/sector schema to reference
// by sector_id.
export const SECTORS: SectorPolygon[] = [
  { sector_id: "SECTOR-A", bounds: [28.61, 77.2, 28.615, 77.21] },
  { sector_id: "SECTOR-B", bounds: [28.615, 77.2, 28.62, 77.21] },
  { sector_id: "SECTOR-C", bounds: [28.61, 77.21, 28.62, 77.22] },
];

// One synthetic "survivor" per sector, at a fixed known coordinate. Atul's
// geolocation service scores its error_m against these — this is the
// judge-facing "accuracy" number described in PRD Section 7.3.
// SECTOR-A and SECTOR-C overlap-by-proxy on the same survivor to exercise
// Rudra's dedup logic (two drones, two sectors, one person).
export const GROUND_TRUTH: GroundTruthSurvivor[] = [
  { sector_id: "SECTOR-A", latitude: 28.6142, longitude: 77.2093, note: "primary survivor, seen by DRONE-01 and DRONE-03" },
  { sector_id: "SECTOR-B", latitude: 28.6178, longitude: 77.2044, note: "isolated survivor, SECTOR-B only" },
  { sector_id: "SECTOR-C", latitude: 28.6142, longitude: 77.2093, note: "same person as SECTOR-A row, re-detected from a different flight path to trigger dedup" },
];
