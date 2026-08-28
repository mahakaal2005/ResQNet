import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

class BBoxDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
  @IsNumber() w!: number;
  @IsNumber() h!: number;
}

class CentroidDto {
  @IsNumber() x!: number;
  @IsNumber() y!: number;
}

// Owner: Faiqua. Co-sign: Rudra. Contract frozen per docs/contracts (Section 10.2).
export class DetectionDto {
  @IsString()
  detection_id!: string;

  @IsString()
  drone_id!: string;

  @IsString()
  sector_id!: string;

  @IsDateString()
  timestamp!: string;

  @ValidateNested()
  @Type(() => BBoxDto)
  bbox!: BBoxDto;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence!: number;

  @ValidateNested()
  @Type(() => CentroidDto)
  centroid!: CentroidDto;
}
