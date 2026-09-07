import { IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { MAX_SECTORS, type GeoJsonPolygon } from '../../sectors/sector-geometry.js';

export class CreateMissionDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  // Shape is validated by assertValidPolygon() in sector-geometry.ts — the
  // module the polygon unit tests already cover — rather than being
  // re-expressed as decorators that could drift from it.
  @IsObject()
  zone_polygon!: GeoJsonPolygon;

  @IsInt()
  @Min(1)
  @Max(MAX_SECTORS)
  sector_count!: number;

  /** Optional so the seed can pin 'MISSION-DEMO-1'; generated when omitted. */
  @IsOptional()
  @IsString()
  @Matches(/^MISSION-[A-Z0-9-]+$/, { message: 'mission_id must look like MISSION-DEMO-1' })
  mission_id?: string;
}
