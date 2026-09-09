import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/jwt.config.js';
import { Mission } from '../missions/entities/mission.entity.js';
import { missionWhere } from '../missions/mission-lookup.js';
import { Sector } from './entities/sector.entity.js';
import {
  assertValidPolygon,
  InvalidPolygonError,
  isWithin,
  splitZoneIntoSectors,
  type GeoJsonPolygon,
  type SectorDefinition,
} from './sector-geometry.js';

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(Sector)
    private readonly sectors: Repository<Sector>,
    @InjectRepository(Mission)
    private readonly missions: Repository<Mission>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cuts a mission zone into `count` equal strips. Pure — nothing is written —
   * so MissionsService can reject an unusable zone before it inserts the
   * mission row, which is what keeps `mission.created` and `sector.assigned`
   * in true chronological order in the audit trail.
   */
  planZoneSplit(zone: GeoJsonPolygon, count: number): SectorDefinition[] {
    try {
      return splitZoneIntoSectors(zone, count);
    } catch (error) {
      if (error instanceof InvalidPolygonError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  /**
   * Stores a planned sector layout. Called once when a mission is created, so
   * every mission has a usable layout before an operator touches POST /sectors
   * — this is demo step 2 ("sector assignment") in Section 27.
   */
  async assignFromZone(
    missionId: string,
    definitions: SectorDefinition[],
    actor?: AuthenticatedUser,
  ): Promise<Sector[]> {
    const rows = definitions.map((definition) =>
      this.sectors.create({
        missionId,
        sectorId: definition.sector_id,
        polygon: definition.polygon,
        assignedDroneId: null,
      }),
    );

    const saved = await this.sectors.save(rows);

    // One row for the whole split, not one per sector: this is a single
    // operator action ("sector assignment", demo step 2), and N rows per
    // mission creation would bury the mission events around it.
    await this.audit.record({
      action: 'sector.assigned',
      missionId,
      actorUserId: actor?.id ?? null,
      entityType: 'sector',
      entityId: null,
      payload: {
        count: saved.length,
        sector_ids: saved.map((sector) => sector.sectorId),
        source: 'zone-split',
      },
    });

    return saved;
  }

  /**
   * Creates or replaces one sector definition.
   *
   * Upsert rather than insert-only: the auto-split above has already claimed
   * SECTOR-A..N, so an operator (or the demo seed) pinning an exact polygon —
   * for instance the layout apps/simulator/src/sectors.ts flies — must be able
   * to overwrite the generated strip instead of colliding with it.
   */
  async upsert(
    missionIdOrUuid: string,
    sectorId: string,
    polygon: GeoJsonPolygon,
    assignedDroneId?: string,
    actor?: AuthenticatedUser,
  ): Promise<Sector> {
    const mission = await this.missions.findOne({ where: missionWhere(missionIdOrUuid) });
    if (!mission) throw new NotFoundException(`Mission ${missionIdOrUuid} not found`);

    try {
      assertValidPolygon(polygon);
    } catch (error) {
      if (error instanceof InvalidPolygonError) throw new BadRequestException(error.message);
      throw error;
    }

    if (!isWithin(polygon, mission.zonePolygon)) {
      throw new BadRequestException(
        `Sector ${sectorId} lies outside the zone of mission ${mission.missionId}`,
      );
    }

    const existing = await this.sectors.findOne({
      where: { missionId: mission.missionId, sectorId },
    });

    const row = this.sectors.create({
      ...existing,
      missionId: mission.missionId,
      sectorId,
      polygon,
      assignedDroneId: assignedDroneId ?? existing?.assignedDroneId ?? null,
    });

    const saved = await this.sectors.save(row);

    // `sector.updated` when it replaced a definition the zone-split had
    // already claimed, so the trail distinguishes an operator refining a
    // sector from one appearing for the first time.
    await this.audit.record({
      action: existing ? 'sector.updated' : 'sector.created',
      missionId: mission.missionId,
      actorUserId: actor?.id ?? null,
      entityType: 'sector',
      entityId: saved.sectorId,
      payload: { assigned_drone_id: saved.assignedDroneId },
    });

    return saved;
  }

  /** Ordered by sector_id so SECTOR-A always comes first on the dashboard. */
  async findForMission(missionIdOrUuid: string): Promise<Sector[]> {
    const mission = await this.missions.findOne({ where: missionWhere(missionIdOrUuid) });
    if (!mission) throw new NotFoundException(`Mission ${missionIdOrUuid} not found`);

    return this.sectors.find({
      where: { missionId: mission.missionId },
      order: { sectorId: 'ASC' },
    });
  }
}
