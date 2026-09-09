import { describe, expect, it } from 'vitest';
import { resolveMissionScope } from './mission-scope.js';

describe('resolveMissionScope', () => {
  it('resolves a sector label to its mission when exactly one live mission claims it', () => {
    expect(resolveMissionScope([{ missionId: 'MISSION-DEMO-1' }])).toBe('MISSION-DEMO-1');
  });

  it('resolves when one mission defines the label more than once', () => {
    // Belt and braces: the (mission_id, sector_id) unique constraint should
    // make this impossible, but a duplicate row must not read as ambiguity.
    expect(
      resolveMissionScope([{ missionId: 'MISSION-DEMO-1' }, { missionId: 'MISSION-DEMO-1' }]),
    ).toBe('MISSION-DEMO-1');
  });

  it('returns null when two live missions both define the label', () => {
    // 'SECTOR-A' exists in every mission, so this is the normal shape of the
    // ambiguity — guessing would file an incident under the wrong mission.
    expect(
      resolveMissionScope([{ missionId: 'MISSION-DEMO-1' }, { missionId: 'MISSION-DEMO-2' }]),
    ).toBeNull();
  });

  it('returns null when no mission claims the label', () => {
    expect(resolveMissionScope([])).toBeNull();
  });
});
