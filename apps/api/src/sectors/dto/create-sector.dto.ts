import { IsObject, IsOptional, IsString, Matches } from 'class-validator';
import type { GeoJsonPolygon } from '../sector-geometry.js';

export class CreateSectorDto {
  /** The mission's uuid or its external mission_id. */
  @IsString()
  mission_id!: string;

  // Same pattern as the frozen telemetry contract and the database CHECK: a
  // sector a drone could never legally report must not be creatable.
  @IsString()
  @Matches(/^SECTOR-[A-Z]$/, { message: 'sector_id must match SECTOR-[A-Z], e.g. SECTOR-A' })
  sector_id!: string;

  @IsObject()
  polygon!: GeoJsonPolygon;

  @IsOptional()
  @IsString()
  @Matches(/^DRONE-[0-9]{2}$/, { message: 'assigned_drone_id must match DRONE-NN, e.g. DRONE-01' })
  assigned_drone_id?: string;
}
