export interface DroneTelemetry {
  drone_id: string;
  sector_id: string;
  timestamp: string;
  lat: number;
  lon: number;
  altitude_m: number;
  heading_deg: number;
  gimbal_pitch_deg: number;
  frame_ref: string;
}

export interface SectorPolygon {
  sector_id: string;
  /** Simple rectangular bounding box for Phase 1 path generation: [minLat, minLon, maxLat, maxLon] */
  bounds: [number, number, number, number];
}

export interface GroundTruthSurvivor {
  sector_id: string;
  latitude: number;
  longitude: number;
  note: string;
}
