import type { AuditLog } from './entities/audit-log.entity.js';

/**
 * Maps an audit row onto its wire shape — snake_case, like every other
 * response in this track. Rationale in `../missions/mission.presenter.ts`.
 *
 * `timestamp` needs no renaming, but it is listed explicitly so adding a
 * column to the entity cannot silently widen the public response.
 */
export interface AuditLogResponse {
  id: string;
  mission_id: string | null;
  actor_user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  timestamp: Date;
}

export function toAuditLogResponse(entry: AuditLog): AuditLogResponse {
  return {
    id: entry.id,
    mission_id: entry.missionId,
    actor_user_id: entry.actorUserId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    payload: entry.payload,
    timestamp: entry.timestamp,
  };
}
