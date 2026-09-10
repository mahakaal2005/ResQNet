import { Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import type { AuditEntry, AuditService } from './audit.service.js';
import type { Sector } from '../sectors/entities/sector.entity.js';
import { IncidentAuditListener } from './incident-audit.listener.js';

/**
 * Guards the invariant this listener exists to uphold: an incident event must
 * always produce an audit row, even when the mission it belongs to cannot be
 * worked out.
 *
 * The regression: mission scoping queries the `sectors` table, which does not
 * exist when the intelligence modules run standalone against migration 0001
 * alone (their documented independent demo). The throw escaped *before*
 * `AuditService.record()` was reached, so every `incident.created` and
 * `incident.updated` row vanished — with only a logged error, because
 * @nestjs/event-emitter swallows handler exceptions. The audit log looked
 * merely incomplete rather than broken.
 */
function collectingAudit(into: AuditEntry[]): AuditService {
  return { record: async (entry: AuditEntry) => void into.push(entry) } as unknown as AuditService;
}

/** A repository whose query builder blows up, as it does with no `sectors` table. */
function brokenSectorRepository(message: string): Repository<Sector> {
  return {
    createQueryBuilder: () => {
      throw new Error(message);
    },
  } as unknown as Repository<Sector>;
}

function scopingRepository(missionIds: string[]): Repository<Sector> {
  const builder = {
    innerJoin: () => builder,
    where: () => builder,
    andWhere: () => builder,
    select: () => builder,
    getRawMany: async () => missionIds.map((missionId) => ({ missionId })),
  };
  return { createQueryBuilder: () => builder } as unknown as Repository<Sector>;
}

describe('IncidentAuditListener', () => {
  it('still records the row when the sectors table is absent', async () => {
    const entries: AuditEntry[] = [];
    const listener = new IncidentAuditListener(
      collectingAudit(entries),
      brokenSectorRepository('No metadata for "Sector" was found.'),
    );

    await listener.onCreated({ incidentId: 'INC-1', sectorId: 'SECTOR-A', priorityScore: 31 });

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      action: 'incident.created',
      entityId: 'INC-1',
      missionId: null,
    });
  });

  it('still records incident.updated, keeping the actor, when scoping fails', async () => {
    const entries: AuditEntry[] = [];
    const listener = new IncidentAuditListener(
      collectingAudit(entries),
      brokenSectorRepository('relation "sectors" does not exist'),
    );

    await listener.onUpdated({
      incidentId: 'INC-1',
      sectorId: 'SECTOR-A',
      status: 'dispatched',
      actorUserId: '00000000-0000-4000-8000-000000000002',
    });

    expect(entries[0]).toMatchObject({
      action: 'incident.updated',
      actorUserId: '00000000-0000-4000-8000-000000000002',
      missionId: null,
    });
  });

  it('scopes the row when exactly one live mission claims the sector', async () => {
    const entries: AuditEntry[] = [];
    const listener = new IncidentAuditListener(
      collectingAudit(entries),
      scopingRepository(['MISSION-DEMO-1']),
    );

    await listener.onCreated({ incidentId: 'INC-1', sectorId: 'SECTOR-A' });

    expect(entries[0].missionId).toBe('MISSION-DEMO-1');
  });

  it('leaves the row unscoped when two live missions share the sector label', async () => {
    const entries: AuditEntry[] = [];
    const listener = new IncidentAuditListener(
      collectingAudit(entries),
      scopingRepository(['MISSION-DEMO-1', 'MISSION-DEMO-2']),
    );

    await listener.onCreated({ incidentId: 'INC-1', sectorId: 'SECTOR-A' });

    expect(entries[0].missionId).toBeNull();
  });

  it('records priority changes without touching the sectors table', async () => {
    const entries: AuditEntry[] = [];
    const listener = new IncidentAuditListener(
      collectingAudit(entries),
      brokenSectorRepository('should never be called — no sectorId on this payload'),
    );

    await listener.onPriorityChanged({ incidentId: 'INC-1', breakdown: { total: 31 } });

    expect(entries[0]).toMatchObject({ action: 'incident.priority_changed', missionId: null });
  });
});
