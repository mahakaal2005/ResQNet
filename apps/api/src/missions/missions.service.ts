import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import type { AuthenticatedUser } from '../auth/jwt.config.js';
import { InvalidPolygonError, type GeoJsonPolygon } from '../sectors/sector-geometry.js';
import { SectorsService } from '../sectors/sectors.service.js';
import { Sector } from '../sectors/entities/sector.entity.js';
import { Mission, MissionStatus } from './entities/mission.entity.js';
import { generateMissionId, missionWhere } from './mission-lookup.js';
import {
  assertValidTransition,
  eventForTransition,
  InvalidMissionTransitionError,
} from './mission-state-machine.js';

export interface CreateMissionInput {
  name: string;
  zone_polygon: GeoJsonPolygon;
  sector_count: number;
  mission_id?: string;
}

@Injectable()
export class MissionsService {
  constructor(
    @InjectRepository(Mission)
    private readonly missions: Repository<Mission>,
    private readonly sectorsService: SectorsService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Creates a mission and its sector layout in one call — demo steps 1 and 2
   * of Section 27 ("operator draws disaster zone", "sector assignment"). The
   * mission starts in `created`; nothing flies until PATCH /:id/status moves
   * it to `active` and mission.started reaches Chirag's gateway.
   */
  async create(
    input: CreateMissionInput,
    actor?: AuthenticatedUser,
  ): Promise<Mission & { sectors: Sector[] }> {
    const missionId = input.mission_id ?? generateMissionId();

    if (await this.missions.exists({ where: { missionId } })) {
      throw new BadRequestException(`Mission ${missionId} already exists`);
    }

    const mission = await this.missions.save(
      this.missions.create({
        missionId,
        name: input.name,
        status: 'created',
        zonePolygon: input.zone_polygon,
        sectorCount: input.sector_count,
        createdBy: actor?.id ?? null,
        startedAt: null,
        completedAt: null,
      }),
    );

    let sectors: Sector[];
    try {
      sectors = await this.sectorsService.assignFromZone(
        missionId,
        input.zone_polygon,
        input.sector_count,
      );
    } catch (error) {
      // The zone was rejected only after the mission row landed; drop it again
      // rather than leaving a mission with no sectors behind.
      await this.missions.delete({ id: mission.id });
      if (error instanceof InvalidPolygonError) throw new BadRequestException(error.message);
      throw error;
    }

    await this.audit.record({
      action: 'mission.created',
      missionId,
      actorUserId: actor?.id ?? null,
      entityType: 'mission',
      entityId: missionId,
      payload: { name: mission.name, sector_count: mission.sectorCount },
    });

    return { ...mission, sectors };
  }

  async findOne(idOrMissionId: string): Promise<Mission> {
    const mission = await this.missions.findOne({ where: missionWhere(idOrMissionId) });
    if (!mission) throw new NotFoundException(`Mission ${idOrMissionId} not found`);
    return mission;
  }

  async findAll(): Promise<Mission[]> {
    return this.missions.find({ order: { createdAt: 'DESC' } });
  }

  /**
   * Drives the mission state machine and publishes the matching Section 10.6
   * event. Chirag's gateway starts and stops simulated drone motion on these,
   * so an invalid transition must fail before anything is emitted.
   */
  async updateStatus(
    idOrMissionId: string,
    next: MissionStatus,
    actor?: AuthenticatedUser,
  ): Promise<Mission> {
    const mission = await this.findOne(idOrMissionId);

    try {
      assertValidTransition(mission.status, next);
    } catch (error) {
      if (error instanceof InvalidMissionTransitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    const event = eventForTransition(mission.status, next);
    const from = mission.status;

    mission.status = next;
    // Set once, on the first activation — the metric in PRD Section 15 is
    // "time from simulated mission start", not time from the last resume.
    if (next === 'active' && !mission.startedAt) mission.startedAt = new Date();
    if (next === 'completed') mission.completedAt = new Date();

    const saved = await this.missions.save(mission);

    this.events.emit(event, {
      mission_id: saved.missionId,
      name: saved.name,
      status: saved.status,
      sector_count: saved.sectorCount,
      started_at: saved.startedAt,
      completed_at: saved.completedAt,
    });

    await this.audit.record({
      action: event,
      missionId: saved.missionId,
      actorUserId: actor?.id ?? null,
      entityType: 'mission',
      entityId: saved.missionId,
      payload: { from, to: next },
    });

    return saved;
  }
}
