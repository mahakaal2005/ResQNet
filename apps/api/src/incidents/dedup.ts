import { Incident } from './entities/incident.entity.js';

export const DEDUP_RADIUS_METERS = 50;
export const DEDUP_TIME_WINDOW_MINUTES = 10;

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance between two lat/lon points, in meters. */
export function haversineDistanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export interface DedupCandidate {
  latitude: number;
  longitude: number;
  timestamp: Date;
}

/**
 * Finds an open incident within DEDUP_RADIUS_METERS and DEDUP_TIME_WINDOW_MINUTES
 * of the given point. Only incidents with status "open" are eligible for merge —
 * confirmed/dispatched/resolved incidents never get silently re-merged.
 */
export function findDuplicateIncident(
  candidate: DedupCandidate,
  openIncidents: Incident[],
): Incident | null {
  const windowMs = DEDUP_TIME_WINDOW_MINUTES * 60 * 1000;

  let best: { incident: Incident; distance: number } | null = null;

  for (const incident of openIncidents) {
    if (incident.status !== 'open') continue;

    const withinTime =
      Math.abs(candidate.timestamp.getTime() - incident.lastSeen.getTime()) <=
      windowMs;
    if (!withinTime) continue;

    const distance = haversineDistanceMeters(candidate, incident);
    if (distance > DEDUP_RADIUS_METERS) continue;

    if (!best || distance < best.distance) {
      best = { incident, distance };
    }
  }

  return best?.incident ?? null;
}
