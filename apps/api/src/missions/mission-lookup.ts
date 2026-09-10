import type { FindOptionsWhere } from 'typeorm';
import type { Mission } from './entities/mission.entity.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A mission has two identifiers: the surrogate uuid and the external
 * `mission_id` ('MISSION-DEMO-1') that every other service puts on the wire.
 * Route parameters accept either, so callers never have to know which one they
 * are holding.
 */
export function missionWhere(idOrMissionId: string): FindOptionsWhere<Mission>[] {
  return UUID_PATTERN.test(idOrMissionId)
    ? [{ id: idOrMissionId }]
    : [{ missionId: idOrMissionId }];
}

/** 'MISSION-' + 8 uppercase base36 characters. Collision-safe enough for a demo fleet. */
export function generateMissionId(): string {
  const suffix = Math.random().toString(36).slice(2, 10).toUpperCase().padEnd(8, '0');
  return `MISSION-${suffix}`;
}
