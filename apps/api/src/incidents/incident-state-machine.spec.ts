import { describe, expect, it } from 'vitest';
import { assertValidTransition, InvalidIncidentTransitionError } from './incident-state-machine.js';

describe('incident state machine', () => {
  it('allows the forward path open -> confirmed -> dispatched -> resolved', () => {
    expect(() => assertValidTransition('open', 'confirmed')).not.toThrow();
    expect(() => assertValidTransition('confirmed', 'dispatched')).not.toThrow();
    expect(() => assertValidTransition('dispatched', 'resolved')).not.toThrow();
  });

  it('rejects skipping a state', () => {
    expect(() => assertValidTransition('open', 'dispatched')).toThrow(
      InvalidIncidentTransitionError,
    );
    expect(() => assertValidTransition('open', 'resolved')).toThrow(
      InvalidIncidentTransitionError,
    );
  });

  it('rejects moving backwards', () => {
    expect(() => assertValidTransition('confirmed', 'open')).toThrow(
      InvalidIncidentTransitionError,
    );
    expect(() => assertValidTransition('resolved', 'dispatched')).toThrow(
      InvalidIncidentTransitionError,
    );
  });

  it('rejects any transition out of resolved', () => {
    expect(() => assertValidTransition('resolved', 'confirmed')).toThrow(
      InvalidIncidentTransitionError,
    );
  });
});
