import { describe, expect, it } from 'vitest';
import { generateMissionId, missionWhere } from './mission-lookup.js';

describe('mission lookup', () => {
  it('matches on the surrogate uuid when given a uuid', () => {
    const id = '00000000-0000-4000-8000-000000000101';
    expect(missionWhere(id)).toEqual([{ id }]);
  });

  it('matches on the external mission_id otherwise', () => {
    expect(missionWhere('MISSION-DEMO-1')).toEqual([{ missionId: 'MISSION-DEMO-1' }]);
  });

  it('generates ids that match the MISSION- prefix convention', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateMissionId()).toMatch(/^MISSION-[A-Z0-9]{8}$/);
    }
  });
});
