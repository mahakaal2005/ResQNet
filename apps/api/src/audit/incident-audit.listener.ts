import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditService } from './audit.service.js';

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
  actorUserId?: string;
  sectorId?: string;
  status?: string;
  priorityScore?: number;
  operatorConfirmed?: boolean;
}

@Injectable()
export class IncidentAuditListener {
  constructor(private readonly audit: AuditService) {}

  @OnEvent('incident.created')
  async onCreated(incident: IncidentEventPayload): Promise<void> {
    await this.audit.record({
      action: 'incident.created',
      entityType: 'incident',
      entityId: incident?.incidentId ?? null,
      payload: {
        sector_id: incident?.sectorId,
        priority_score: incident?.priorityScore,
      },
    });
  }

  @OnEvent('incident.updated')
  async onUpdated(incident: IncidentEventPayload): Promise<void> {
    await this.audit.record({
      action: 'incident.updated',
      actorUserId: incident?.actorUserId,
      entityType: 'incident',
      entityId: incident?.incidentId ?? null,
      payload: {
        status: incident?.status,
        operator_confirmed: incident?.operatorConfirmed,
      },
    });
  }

  @OnEvent('incident.priority_changed')
  async onPriorityChanged(event: {
    incidentId?: string;
    breakdown?: unknown;
  }): Promise<void> {
    await this.audit.record({
      action: 'incident.priority_changed',
      entityType: 'incident',
      entityId: event?.incidentId ?? null,
      payload: { breakdown: event?.breakdown as Record<string, unknown> },
    });
  }
}
