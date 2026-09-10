import type { Sector } from './entities/sector.entity.js';
import type { GeoJsonPolygon } from './sector-geometry.js';

/**
 * Maps the Sector entity onto its wire shape — snake_case, matching
 * `mock_sectors.json` and the frozen `docs/contracts/mission.md`. Rationale in
 * `../missions/mission.presenter.ts`.
 */
export interface SectorResponse {
  id: string;
  mission_id: string;
  sector_id: string;
  polygon: GeoJsonPolygon;
  assigned_drone_id: string | null;
  created_at: Date;
}

export function toSectorResponse(sector: Sector): SectorResponse {
  return {
    id: sector.id,
    mission_id: sector.missionId,
    sector_id: sector.sectorId,
    polygon: sector.polygon,
    assigned_drone_id: sector.assignedDroneId,
    created_at: sector.createdAt,
  };
}
