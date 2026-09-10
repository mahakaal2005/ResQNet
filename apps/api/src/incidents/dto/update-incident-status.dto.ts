import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import type { IncidentStatus } from '../entities/incident.entity.js';

const STATUSES: IncidentStatus[] = ['open', 'confirmed', 'dispatched', 'resolved'];

export class UpdateIncidentStatusDto {
  @IsIn(STATUSES)
  status!: IncidentStatus;

  // Operator-entered distress indicator (PRD 5.4) — optional on every status
  // update, recomputes priority when it changes.
  @IsOptional()
  @IsBoolean()
  distress_flag?: boolean;
}
