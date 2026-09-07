// Transparent, additive priority scoring. Weights and caps are documented in
// docs/contracts/priority-weights.md — this file is the single source of truth
// for the formula; the dashboard (Ayush) only ever renders the breakdown below,
// it never recomputes it client-side.

export const PRIORITY_WEIGHTS = {
  PEOPLE_COUNT_CAP: 30,
  PEOPLE_COUNT_PER_PERSON: 10,
  ISOLATION_CAP: 20,
  TIME_FACTOR_CAP: 20,
  TIME_FACTOR_MINUTES_TO_MAX: 60,
  DISTRESS_FLAG_POINTS: 20,
} as const;

export interface PriorityInput {
  /** Estimated number of people in the incident. */
  peopleCount: number;
  /** 0 (on/near a road or access point) .. 1 (fully isolated). */
  isolationScore: number;
  /** Minutes elapsed since the survivor was last seen moving. */
  minutesSinceLastMovement: number;
  /** Operator-entered or AI-inferred distress indicator. */
  distressFlag: boolean;
}

export interface PriorityBreakdown {
  people_count: number;
  isolation: number;
  time_factor: number;
  distress_flag: number;
  total: number;
}

export function computePriorityScore(input: PriorityInput): PriorityBreakdown {
  const peopleCount = Math.min(
    input.peopleCount * PRIORITY_WEIGHTS.PEOPLE_COUNT_PER_PERSON,
    PRIORITY_WEIGHTS.PEOPLE_COUNT_CAP,
  );

  const isolation =
    clamp01(input.isolationScore) * PRIORITY_WEIGHTS.ISOLATION_CAP;

  const timeFactor =
    Math.min(
      input.minutesSinceLastMovement / PRIORITY_WEIGHTS.TIME_FACTOR_MINUTES_TO_MAX,
      1,
    ) * PRIORITY_WEIGHTS.TIME_FACTOR_CAP;

  const distressFlag = input.distressFlag
    ? PRIORITY_WEIGHTS.DISTRESS_FLAG_POINTS
    : 0;

  const round = (n: number) => Math.round(n);

  const breakdown = {
    people_count: round(peopleCount),
    isolation: round(isolation),
    time_factor: round(timeFactor),
    distress_flag: round(distressFlag),
  };

  return {
    ...breakdown,
    total:
      breakdown.people_count +
      breakdown.isolation +
      breakdown.time_factor +
      breakdown.distress_flag,
  };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
