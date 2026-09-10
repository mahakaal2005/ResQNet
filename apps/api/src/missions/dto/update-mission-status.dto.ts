import { IsIn } from 'class-validator';
import type { MissionStatus } from '../entities/mission.entity.js';

const STATUSES: MissionStatus[] = ['created', 'active', 'paused', 'completed'];

export class UpdateMissionStatusDto {
  @IsIn(STATUSES)
  status!: MissionStatus;
}
