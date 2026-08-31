import { MissionStatus } from './entities/mission.entity.js';

/**
 * Mission lifecycle. Forward-only apart from the deliberate active <-> paused
 * cycle, which the operator drives from the dashboard.
 *
 *   created --start--> active --pause--> paused --start--> active
 *                        \                  /
 *                         `--complete-->completed (terminal)
 */
const ALLOWED_TRANSITIONS: Record<MissionStatus, MissionStatus[]> = {
  created: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

/**
 * The event published on each edge. Section 10.6 defines exactly three mission
 * events, so resuming a paused mission re-emits mission.started rather than
 * inventing a fourth — Chirag's gateway restarts simulated drone motion on
 * that event, which is precisely the intended effect.
 */
export type MissionEvent = 'mission.started' | 'mission.paused' | 'mission.completed';

const TRANSITION_EVENTS: Partial<Record<`${MissionStatus}->${MissionStatus}`, MissionEvent>> = {
  'created->active': 'mission.started',
  'paused->active': 'mission.started',
  'active->paused': 'mission.paused',
  'active->completed': 'mission.completed',
  'paused->completed': 'mission.completed',
};

export class InvalidMissionTransitionError extends Error {
  constructor(from: MissionStatus, to: MissionStatus) {
    super(`Cannot transition mission from "${from}" to "${to}"`);
    this.name = 'InvalidMissionTransitionError';
  }
}

/** Throws InvalidMissionTransitionError if the transition isn't allowed. */
export function assertValidTransition(from: MissionStatus, to: MissionStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidMissionTransitionError(from, to);
  }
}

/** The event to publish for a transition. Assumes the transition is already valid. */
export function eventForTransition(from: MissionStatus, to: MissionStatus): MissionEvent {
  const event = TRANSITION_EVENTS[`${from}->${to}`];
  if (!event) throw new InvalidMissionTransitionError(from, to);
  return event;
}
