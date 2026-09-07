import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity.js';
import { missionWhere } from '../missions/mission-lookup.js';
import { Sector } from './entities/sector.entity.js';
import {
  assertValidPolygon,
  InvalidPolygonError,
  isWithin,
  splitZoneIntoSectors,
  type GeoJsonPolygon,
} from './sector-geometry.js';

@Injectable()
export class SectorsService {
  constructor(
    @InjectRepository(Sector)
    private readonly sectors: Repository<Sector>,
    @InjectRepository(Mission)
    private readonly missions: Repository<Mission>,
  ) {}

  /**
   * Cuts a mission zone into `count` equal strips and stores them. Called once
   * when a mission is created, so every mission has a usable sector layout
   * before an operator touches POST /sectors — this is demo step 2 ("sector
   * assignment") in Section 27.
   */
  async assignFromZone(
    missionId: string,
    zone: GeoJsonPolygon,
    count: number,
  ): Promise<Sector[]> {
    const definitions = this.split(zone, count);

    const rows = definitions.map((definition) =>
      this.sectors.create({
        missionId,
        sectorId: definition.sector_id,
        polygon: definition.polygon,
        assignedDroneId: null,
      }),
    );

    return this.sectors.save(rows);
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

    return this.sectors.save(row);
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

  /** Maps the pure geometry module's errors onto HTTP 400. */
  private split(zone: GeoJsonPolygon, count: number) {
    try {
      return splitZoneIntoSectors(zone, count);
    } catch (error) {
      if (error instanceof InvalidPolygonError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
