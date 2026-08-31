import { describe, expect, it } from 'vitest';
import {
  assertValidTransition,
  eventForTransition,
  InvalidMissionTransitionError,
} from './mission-state-machine.js';
import { MissionStatus } from './entities/mission.entity.js';

describe('mission state machine', () => {
  it('walks the full demo lifecycle: created -> active -> paused -> active -> completed', () => {
    const walk: MissionStatus[] = ['created', 'active', 'paused', 'active', 'completed'];
    for (let i = 0; i < walk.length - 1; i++) {
      expect(() => assertValidTransition(walk[i], walk[i + 1])).not.toThrow();
    }
  });

  it.each([
    ['created', 'paused'],
    ['created', 'completed'],
    ['active', 'created'],
    ['paused', 'created'],
    ['active', 'active'],
  ] as [MissionStatus, MissionStatus][])('rejects %s -> %s', (from, to) => {
    expect(() => assertValidTransition(from, to)).toThrow(InvalidMissionTransitionError);
  });

  it('treats completed as terminal', () => {
    for (const to of ['created', 'active', 'paused', 'completed'] as MissionStatus[]) {
      expect(() => assertValidTransition('completed', to)).toThrow(InvalidMissionTransitionError);
    }
  });

  it('publishes the three Section 10.6 events on the right edges', () => {
    expect(eventForTransition('created', 'active')).toBe('mission.started');
    expect(eventForTransition('active', 'paused')).toBe('mission.paused');
    expect(eventForTransition('active', 'completed')).toBe('mission.completed');
    expect(eventForTransition('paused', 'completed')).toBe('mission.completed');
  });

  it('re-emits mission.started on resume so Chirag restarts drone motion', () => {
    expect(eventForTransition('paused', 'active')).toBe('mission.started');
  });
});
