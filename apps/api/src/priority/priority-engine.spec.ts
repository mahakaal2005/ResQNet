import { describe, expect, it } from 'vitest';
import { computePriorityScore } from './priority-engine.js';

describe('computePriorityScore', () => {
  it('matches the documented worked example (docs/contracts/priority-weights.md)', () => {
    const breakdown = computePriorityScore({
      peopleCount: 3,
      isolationScore: 1,
      minutesSinceLastMovement: 51,
      distressFlag: true,
    });

    expect(breakdown).toEqual({
      people_count: 30,
      isolation: 20,
      time_factor: 17,
      distress_flag: 20,
      total: 87,
    });
  });

  it('the breakdown always sums exactly to total', () => {
    const cases = [
      { peopleCount: 0, isolationScore: 0, minutesSinceLastMovement: 0, distressFlag: false },
      { peopleCount: 1, isolationScore: 0.3, minutesSinceLastMovement: 12, distressFlag: false },
      { peopleCount: 10, isolationScore: 1, minutesSinceLastMovement: 500, distressFlag: true },
    ];

    for (const input of cases) {
      const b = computePriorityScore(input);
      expect(b.total).toBe(b.people_count + b.isolation + b.time_factor + b.distress_flag);
    }
  });

  it('caps people_count at 30 regardless of survivor count', () => {
    const b = computePriorityScore({
      peopleCount: 50,
      isolationScore: 0,
      minutesSinceLastMovement: 0,
      distressFlag: false,
    });
    expect(b.people_count).toBe(30);
  });

  it('caps time_factor at 20 for long-elapsed incidents', () => {
    const b = computePriorityScore({
      peopleCount: 0,
      isolationScore: 0,
      minutesSinceLastMovement: 10_000,
      distressFlag: false,
    });
    expect(b.time_factor).toBe(20);
  });

  it('distress_flag contributes 0 or exactly 20, never a partial value', () => {
    const off = computePriorityScore({
      peopleCount: 0,
      isolationScore: 0,
      minutesSinceLastMovement: 0,
      distressFlag: false,
    });
    const on = computePriorityScore({
      peopleCount: 0,
      isolationScore: 0,
      minutesSinceLastMovement: 0,
      distressFlag: true,
    });
    expect(off.distress_flag).toBe(0);
    expect(on.distress_flag).toBe(20);
  });
});
