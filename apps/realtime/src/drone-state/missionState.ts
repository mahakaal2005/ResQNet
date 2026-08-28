/**
 * Standalone-demo fixture for mission.started / mission.paused.
 *
 * Per Section 23 (Dependency Matrix), Chirag's only Week-1 dependency is
 * Charan's mission.started event — and it's explicitly allowed to be a
 * "static mission-event fixture" so Chirag is never blocked. This module
 * plays that fixture on a short delay after a client connects, then can be
 * swapped for a real subscription to Charan's mission API in Week 2 with no
 * change to the gateway or simulator.
 */
export type MissionEvent = "mission.started" | "mission.paused";

export function scheduleMockMissionStart(emit: (event: MissionEvent) => void, delayMs = 500): NodeJS.Timeout {
  return setTimeout(() => emit("mission.started"), delayMs);
}
