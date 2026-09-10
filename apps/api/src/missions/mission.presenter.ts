import type { Sector } from '../sectors/entities/sector.entity.js';
import { toSectorResponse, type SectorResponse } from '../sectors/sector.presenter.js';
import type { Mission } from './entities/mission.entity.js';

/**
 * Maps the Mission entity onto its wire shape.
 *
 * Returning the entity directly leaked TypeORM's camelCase property names,
 * which contradicted all three published artefacts — `mock_missions.json`,
 * `docs/contracts/mission.md` (frozen at v1.0), and the `mission.*` events we
 * emit — every one of which is snake_case. Anyone building against the
 * fixtures, which is what they were published for, would have hit the
 * mismatch only at integration. That is Risk #9 exactly.
 *
 * snake_case is the wire convention across this whole repo: the frozen
 * `telemetry.schema.json`, Rudra's detection and geolocation contracts, our
 * own request bodies, and the one response in this track that was always
 * hand-written — `GET /operators/me`. This brings the rest into line with the
 * contract as published, so it changes no contract; it fixes a drift away
 * from one.
 */
export interface MissionResponse {
  id: string;
  mission_id: string;
  name: string;
  status: string;
  zone_polygon: unknown;
  sector_count: number;
  created_by: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export function toMissionResponse(mission: Mission): MissionResponse {
  return {
    id: mission.id,
    mission_id: mission.missionId,
    name: mission.name,
    status: mission.status,
    zone_polygon: mission.zonePolygon,
    sector_count: mission.sectorCount,
    created_by: mission.createdBy,
    started_at: mission.startedAt,
    completed_at: mission.completedAt,
    created_at: mission.createdAt,
    updated_at: mission.updatedAt,
  };
}

/** POST /missions answers with the mission and the layout it just generated. */
export function toMissionWithSectorsResponse(
  mission: Mission,
  sectors: Sector[],
): MissionResponse & { sectors: SectorResponse[] } {
  return { ...toMissionResponse(mission), sectors: sectors.map(toSectorResponse) };
}
