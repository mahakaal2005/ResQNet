import { IncidentStatus } from './entities/incident.entity.js';

const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ['confirmed'],
  confirmed: ['dispatched'],
  dispatched: ['resolved'],
  resolved: [],
};

export class InvalidIncidentTransitionError extends Error {
  constructor(from: IncidentStatus, to: IncidentStatus) {
    super(`Cannot transition incident from "${from}" to "${to}"`);
    this.name = 'InvalidIncidentTransitionError';
  }
}

/** Throws InvalidIncidentTransitionError if the transition isn't allowed. */
export function assertValidTransition(from: IncidentStatus, to: IncidentStatus): void {
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidIncidentTransitionError(from, to);
  }
}
