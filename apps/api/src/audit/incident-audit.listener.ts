import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from '../missions/entities/mission.entity.js';
import { Sector } from '../sectors/entities/sector.entity.js';
import { AuditService } from './audit.service.js';
import { resolveMissionScope, type SectorScope } from './mission-scope.js';

/**
 * The optional "subscribes to all events" half of Section 3: incident
 * lifecycle changes land in the same operator-facing audit trail as mission
 * and auth actions, so `GET /audit-logs?mission_id=` tells the whole story of
 * a mission in one query.
 *
 * Structurally typed on purpose — it never imports from `src/incidents/**`
 * (Rudra's folder), only the event names frozen in Section 10.6. If the
 * intelligence modules are not wired in, these events simply never fire.
 */
interface IncidentEventPayload {
  incidentId?: string;
  sectorId?: string;
  status?: string;
  priorityScore?: number;
  operatorConfirmed?: boolean;
}

@Injectable()
export class IncidentAuditListener {
  constructor(
    private readonly audit: AuditService,
    @InjectRepository(Sector)
    private readonly sectors: Repository<Sector>,
  ) {}

  @OnEvent('incident.created')
  async onCreated(incident: IncidentEventPayload): Promise<void> {
    await this.audit.record({
      action: 'incident.created',
      missionId: await this.missionForSector(incident?.sectorId),
      entityType: 'incident',
      entityId: incident?.incidentId ?? null,
      payload: { sector_id: incident?.sectorId, priority_score: incident?.priorityScore },
    });
  }

  @OnEvent('incident.updated')
  async onUpdated(incident: IncidentEventPayload): Promise<void> {
    await this.audit.record({
      action: 'incident.updated',
      missionId: await this.missionForSector(incident?.sectorId),
      entityType: 'incident',
      entityId: incident?.incidentId ?? null,
      payload: { status: incident?.status, operator_confirmed: incident?.operatorConfirmed },
    });
  }

  /**
   * No `sectorId` on this payload, so the row lands unscoped and shows up only
   * in the unfiltered log. Closing that gap needs `sector_id` added to the
   * `incident.priority_changed` payload in `src/incidents/**` — Rudra's file
   * and Rudra's contract, so it is flagged here rather than changed.
   */
  @OnEvent('incident.priority_changed')
  async onPriorityChanged(event: {
    incidentId?: string;
    sectorId?: string;
    breakdown?: unknown;
  }): Promise<void> {
    await this.audit.record({
      action: 'incident.priority_changed',
      missionId: await this.missionForSector(event?.sectorId),
      entityType: 'incident',
      entityId: event?.incidentId ?? null,
      payload: { breakdown: event?.breakdown as Record<string, unknown> },
    });
  }

  /**
   * Maps a sector label onto its mission via our own `sectors` table, ignoring
   * completed missions so a finished demo run cannot make a live label
   * ambiguous. Reads only tables this track owns.
   */
  private async missionForSector(sectorId?: string): Promise<string | null> {
    if (!sectorId) return null;

    const candidates = await this.sectors
      .createQueryBuilder('sector')
      .innerJoin(Mission, 'mission', 'mission.mission_id = sector.mission_id')
      .where('sector.sector_id = :sectorId', { sectorId })
      .andWhere('mission.status != :completed', { completed: 'completed' })
      .select('sector.mission_id', 'missionId')
      .getRawMany<SectorScope>();

    return resolveMissionScope(candidates);
  }
}
