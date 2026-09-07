// Pure geometry for search sectors. No framework, no database — this is the
// module the "sector-polygon validation" unit tests in Section 3 exercise.

/** A GeoJSON Polygon with a single, closed exterior ring. Coordinates are [lon, lat]. */
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export interface SectorDefinition {
  sector_id: string;
  polygon: GeoJsonPolygon;
}

/**
 * The frozen telemetry contract constrains sector ids to ^SECTOR-[A-Z]$, so a
 * mission can hold at most 26 sectors. Anything more could not be reported by
 * a drone and must be rejected at mission-creation time rather than surfacing
 * later as unroutable telemetry.
 */
export const MAX_SECTORS = 26;

export class InvalidPolygonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPolygonError';
  }
}

/** Throws InvalidPolygonError if the polygon is not a well-formed closed ring. */
export function assertValidPolygon(polygon: GeoJsonPolygon): void {
  if (polygon?.type !== 'Polygon') {
    throw new InvalidPolygonError('Polygon must have type "Polygon"');
  }

  const ring = polygon.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) {
    throw new InvalidPolygonError(
      'Polygon exterior ring needs at least 4 positions (3 corners plus the repeated closing point)',
    );
  }

  for (const [lon, lat] of ring) {
    if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
      throw new InvalidPolygonError(`Longitude ${lon} is outside [-180, 180]`);
    }
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new InvalidPolygonError(`Latitude ${lat} is outside [-90, 90]`);
    }
  }

  const [first, last] = [ring[0], ring[ring.length - 1]];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    throw new InvalidPolygonError('Polygon exterior ring must be closed (last position must equal the first)');
  }
}

export interface BoundingBox {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

export function boundingBox(polygon: GeoJsonPolygon): BoundingBox {
  const ring = polygon.coordinates[0];
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return {
    lonMin: Math.min(...lons),
    lonMax: Math.max(...lons),
    latMin: Math.min(...lats),
    latMax: Math.max(...lats),
  };
}

/** True when `inner` lies entirely inside `outer`, compared on bounding boxes. */
export function isWithin(inner: GeoJsonPolygon, outer: GeoJsonPolygon): boolean {
  const i = boundingBox(inner);
  const o = boundingBox(outer);
  return (
    i.lonMin >= o.lonMin && i.lonMax <= o.lonMax && i.latMin >= o.latMin && i.latMax <= o.latMax
  );
}

/** 0 -> "SECTOR-A", 1 -> "SECTOR-B", ... */
export function sectorLabel(index: number): string {
  if (index < 0 || index >= MAX_SECTORS) {
    throw new RangeError(`Sector index ${index} is outside 0..${MAX_SECTORS - 1}`);
  }
  return `SECTOR-${String.fromCharCode(65 + index)}`;
}

/**
 * Splits a mission zone into `count` equal strips along its longer axis.
 *
 * Deliberately the simplest split that is explainable to a judge in one
 * sentence ("the zone is cut into equal strips"), per the plan's
 * Simplicity-first priority order. The demo seed inserts explicit polygons
 * instead, so this never has to reproduce the simulator's hand-drawn layout.
 */
export function splitZoneIntoSectors(zone: GeoJsonPolygon, count: number): SectorDefinition[] {
  assertValidPolygon(zone);

  if (!Number.isInteger(count) || count < 1) {
    throw new InvalidPolygonError(`sector_count must be a positive integer, got ${count}`);
  }
  if (count > MAX_SECTORS) {
    throw new InvalidPolygonError(
      `sector_count ${count} exceeds the ${MAX_SECTORS}-sector limit imposed by the SECTOR-[A-Z] telemetry contract`,
    );
  }

  const { lonMin, lonMax, latMin, latMax } = boundingBox(zone);
  const splitAlongLon = lonMax - lonMin >= latMax - latMin;

  return Array.from({ length: count }, (_, i) => {
    const from = i / count;
    const to = (i + 1) / count;

    const [x0, x1, y0, y1] = splitAlongLon
      ? [lonMin + (lonMax - lonMin) * from, lonMin + (lonMax - lonMin) * to, latMin, latMax]
      : [lonMin, lonMax, latMin + (latMax - latMin) * from, latMin + (latMax - latMin) * to];

    return {
      sector_id: sectorLabel(i),
      polygon: {
        type: 'Polygon',
        coordinates: [
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
            [x0, y0],
          ],
        ],
      } as GeoJsonPolygon,
    };
  });
}
