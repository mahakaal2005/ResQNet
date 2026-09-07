import { describe, expect, it } from 'vitest';
import type { Incident } from './entities/incident.entity.js';
import { findDuplicateIncident, haversineDistanceMeters } from './dedup.js';

function makeIncident(overrides: Partial<Incident>): Incident {
  return {
    id: 'uuid-1',
    incidentId: 'INC-0001',
    latitude: 28.6142,
    longitude: 77.2093,
    location: null,
    survivorCountEstimate: 1,
    confidence: 0.9,
    priorityScore: 0,
    status: 'open',
    firstSeen: new Date('2026-08-27T10:30:00Z'),
    lastSeen: new Date('2026-08-27T10:30:00Z'),
    evidence: [],
    sourceDrones: ['DRONE-01'],
    sectorId: 'SECTOR-A',
    operatorConfirmed: false,
    distressFlag: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Incident;
}

describe('haversineDistanceMeters', () => {
  it('returns ~0 for identical points', () => {
    const p = { latitude: 28.6142, longitude: 77.2093 };
    expect(haversineDistanceMeters(p, p)).toBeCloseTo(0, 3);
  });

  it('matches a known reference distance within tolerance', () => {
    // ~111km per degree of latitude at the equator-ish reference.
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 1, longitude: 0 };
    expect(haversineDistanceMeters(a, b)).toBeCloseTo(111_195, -2);
  });
});

describe('findDuplicateIncident', () => {
  it('merges a detection within radius and time window into the existing open incident', () => {
    const incident = makeIncident({});
    const candidate = {
      latitude: 28.61423,
      longitude: 77.20934,
      timestamp: new Date('2026-08-27T10:31:40Z'),
    };

    expect(findDuplicateIncident(candidate, [incident])).toBe(incident);
  });

  it('does not merge when the point is outside the proximity radius', () => {
    const incident = makeIncident({});
    const candidate = {
      latitude: 28.62, // ~700m away
      longitude: 77.2093,
      timestamp: new Date('2026-08-27T10:31:00Z'),
    };

    expect(findDuplicateIncident(candidate, [incident])).toBeNull();
  });

  it('does not merge when outside the time window even if close by', () => {
    const incident = makeIncident({});
    const candidate = {
      latitude: 28.6142,
      longitude: 77.2093,
      timestamp: new Date('2026-08-27T10:45:00Z'), // 15 min later
    };

    expect(findDuplicateIncident(candidate, [incident])).toBeNull();
  });

  it('never merges into a non-open incident', () => {
    const incident = makeIncident({ status: 'confirmed' });
    const candidate = {
      latitude: 28.6142,
      longitude: 77.2093,
      timestamp: new Date('2026-08-27T10:30:10Z'),
    };

    expect(findDuplicateIncident(candidate, [incident])).toBeNull();
  });

  it('picks the closest match when multiple open incidents qualify', () => {
    const near = makeIncident({ incidentId: 'INC-NEAR', latitude: 28.61421, longitude: 77.20931 });
    const far = makeIncident({ incidentId: 'INC-FAR', latitude: 28.6144, longitude: 77.2095 });
    const candidate = {
      latitude: 28.6142,
      longitude: 77.2093,
      timestamp: new Date('2026-08-27T10:30:10Z'),
    };

    expect(findDuplicateIncident(candidate, [far, near])).toBe(near);
  });
});
