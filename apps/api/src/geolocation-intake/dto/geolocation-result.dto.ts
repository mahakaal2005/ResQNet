import { IsNumber, IsString } from 'class-validator';

// Owner: Atul. Co-sign: Rudra. Contract frozen per docs/contracts (Section 10.3).
export class GeolocationResultDto {
  @IsString()
  detection_id!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsNumber()
  error_m!: number;

  @IsString()
  method!: string;
}
