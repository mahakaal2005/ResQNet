import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';

export interface AuditEntry {
  action: string;
  missionId?: string | null;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  payload?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  /**
   * Writes one audit row.
   *
   * Never throws: the audit log is a read-only, non-blocking consumer
   * (Section 3, "Events consumed"), so a failure to record must not take down
   * the operator action that produced it. A failed write is logged loudly
   * instead — losing the row silently would be worse than losing it noisily.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.logs.save(
        this.logs.create({
          action: entry.action,
          missionId: entry.missionId ?? null,
          actorUserId: entry.actorUserId ?? null,
          entityType: entry.entityType ?? null,
          entityId: entry.entityId ?? null,
          payload: entry.payload ?? {},
        }),
      );
    } catch (error) {
      this.logger.error(`Failed to write audit entry "${entry.action}"`, error as Error);
    }
  }

  /** Newest first. `missionId` undefined returns the whole log. */
  async find(missionId?: string, limit = 200): Promise<AuditLog[]> {
    return this.logs.find({
      where: missionId ? { missionId } : {},
      order: { timestamp: 'DESC' },
      take: limit,
    });
  }
}
