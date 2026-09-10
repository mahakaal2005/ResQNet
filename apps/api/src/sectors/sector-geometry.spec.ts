import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertValidPolygon,
  boundingBox,
  type BoundingBox,
  GeoJsonPolygon,
  InvalidPolygonError,
  isWithin,
  MAX_SECTORS,
  sectorLabel,
  splitZoneIntoSectors,
} from './sector-geometry.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const readJson = (rel: string) => JSON.parse(readFileSync(path.join(repoRoot, rel), 'utf-8'));

const SQUARE: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [77.2, 28.61],
      [77.22, 28.61],
      [77.22, 28.62],
      [77.2, 28.62],
      [77.2, 28.61],
    ],
  ],
};

describe('polygon validation', () => {
  it('accepts a well-formed closed ring', () => {
    expect(() => assertValidPolygon(SQUARE)).not.toThrow();
  });

  it('rejects an unclosed ring', () => {
    const open = { type: 'Polygon', coordinates: [SQUARE.coordinates[0].slice(0, -1)] };
    expect(() => assertValidPolygon(open as GeoJsonPolygon)).toThrow(InvalidPolygonError);
  });

  it('rejects a ring with too few positions', () => {
    const sliver: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [77.2, 28.61],
          [77.22, 28.61],
          [77.2, 28.61],
        ],
      ],
    };
    expect(() => assertValidPolygon(sliver)).toThrow(InvalidPolygonError);
  });

  it('rejects out-of-range coordinates', () => {
    const bad: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [200, 28.61],
          [77.22, 28.61],
          [77.22, 28.62],
          [200, 28.61],
        ],
      ],
    };
    expect(() => assertValidPolygon(bad)).toThrow(/Longitude/);
  });

  // A swapped [lat, lon] pair is the most likely GeoJSON mistake, and range
  // checking alone cannot always catch it: our demo zone sits at lon 77.2 /
  // lat 28.6, and 77.2 is a perfectly legal latitude. Range validation only
  // fires when the swap pushes latitude past 90. The real defence for sectors
  // is the containment check below, which is why POST /sectors runs both.
  it('rejects a swapped pair when the swap pushes latitude out of range', () => {
    const swapped: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [28.61, 120.5],
          [28.62, 120.5],
          [28.62, 120.6],
          [28.61, 120.5],
        ],
      ],
    };
    expect(() => assertValidPolygon(swapped)).toThrow(/Latitude/);
  });

  it('catches an in-range swap by containment instead, since ranges cannot', () => {
    const swapped: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [28.61, 77.2],
          [28.62, 77.2],
          [28.62, 77.22],
          [28.61, 77.2],
        ],
      ],
    };
    // Well-formed in isolation...
    expect(() => assertValidPolygon(swapped)).not.toThrow();
    // ...but nowhere near the mission zone it claims to belong to.
    expect(isWithin(swapped, SQUARE)).toBe(false);
  });
});

describe('sector splitting', () => {
  it('produces `count` sectors labelled from SECTOR-A', () => {
    const sectors = splitZoneIntoSectors(SQUARE, 3);
    expect(sectors.map((s) => s.sector_id)).toEqual(['SECTOR-A', 'SECTOR-B', 'SECTOR-C']);
  });

  it('produces sectors that are all valid and all inside the zone', () => {
    for (const sector of splitZoneIntoSectors(SQUARE, 5)) {
      expect(() => assertValidPolygon(sector.polygon)).not.toThrow();
      expect(isWithin(sector.polygon, SQUARE)).toBe(true);
    }
  });

  it('tiles the zone with no gap along the split axis', () => {
    const sectors = splitZoneIntoSectors(SQUARE, 4);
    const zone = boundingBox(SQUARE);
    const boxes = sectors.map((s) => boundingBox(s.polygon));

    expect(boxes[0].lonMin).toBeCloseTo(zone.lonMin, 10);
    expect(boxes[boxes.length - 1].lonMax).toBeCloseTo(zone.lonMax, 10);
    for (let i = 0; i < boxes.length - 1; i++) {
      expect(boxes[i].lonMax).toBeCloseTo(boxes[i + 1].lonMin, 10);
    }
  });

  it('splits along the longer axis', () => {
    const tall: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: [
        [
          [77.2, 28.0],
          [77.21, 28.0],
          [77.21, 29.0],
          [77.2, 29.0],
          [77.2, 28.0],
        ],
      ],
    };
    const [first, second] = splitZoneIntoSectors(tall, 2).map((s) => boundingBox(s.polygon));
    expect(first.latMax).toBeCloseTo(second.latMin, 10);
    expect(first.lonMin).toBeCloseTo(second.lonMin, 10);
  });

  it('refuses more sectors than the SECTOR-[A-Z] contract can name', () => {
    expect(() => splitZoneIntoSectors(SQUARE, MAX_SECTORS)).not.toThrow();
    expect(() => splitZoneIntoSectors(SQUARE, MAX_SECTORS + 1)).toThrow(/telemetry contract/);
  });

  it('rejects a non-positive sector_count', () => {
    expect(() => splitZoneIntoSectors(SQUARE, 0)).toThrow(InvalidPolygonError);
    expect(() => splitZoneIntoSectors(SQUARE, 2.5)).toThrow(InvalidPolygonError);
  });

  it('labels sectors A..Z and refuses to go past Z', () => {
    expect(sectorLabel(0)).toBe('SECTOR-A');
    expect(sectorLabel(25)).toBe('SECTOR-Z');
    expect(() => sectorLabel(26)).toThrow(RangeError);
  });
});

// Contract test: our published fixtures must agree with the simulator's real
// output. This is what stops the mission/sector geometry drifting away from
// the sectors Chirag's drones actually fly.
describe('published fixtures agree with the simulator', () => {
  const mission = readJson('packages/contracts/mocks/mock_missions.json')[0];
  const sectors = readJson('packages/contracts/mocks/mock_sectors.json');
  const telemetry = readJson('apps/simulator/sample_telemetry.json');

  it('every fixture polygon is well-formed', () => {
    expect(() => assertValidPolygon(mission.zone_polygon)).not.toThrow();
    for (const s of sectors) expect(() => assertValidPolygon(s.polygon)).not.toThrow();
  });

  it('every sector sits inside the mission zone', () => {
    for (const s of sectors) {
      expect(isWithin(s.polygon, mission.zone_polygon), `${s.sector_id} escapes the zone`).toBe(
        true,
      );
    }
  });

  it('sector ids satisfy the frozen telemetry pattern', () => {
    for (const s of sectors) expect(s.sector_id).toMatch(/^SECTOR-[A-Z]$/);
    expect(sectors).toHaveLength(mission.sector_count);
  });

  it('every simulator telemetry packet falls inside the sector it declares', () => {
    const byId = new Map<string, BoundingBox>(
      sectors.map((s: any) => [s.sector_id, boundingBox(s.polygon)] as const),
    );
    const escaped = telemetry.filter((p: any) => {
      const box = byId.get(p.sector_id);
      return !box || p.lon < box.lonMin || p.lon > box.lonMax || p.lat < box.latMin || p.lat > box.latMax;
    });
    expect(escaped, `${escaped.length} packets outside their sector`).toHaveLength(0);
  });
});
