import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { GeoJsonPolygon } from '../sector-geometry.js';

@Entity('sectors')
@Index(['missionId'])
@Unique(['missionId', 'sectorId'])
export class Sector {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'mission_id' })
  missionId!: string;

  // Matches ^SECTOR-[A-Z]$ — the same pattern the frozen telemetry schema
  // enforces, so a sector the simulator could never legally report cannot be
  // created here. The database CHECK in 0002 is the backstop.
  @Column({ name: 'sector_id' })
  sectorId!: string;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  polygon!: GeoJsonPolygon;

  // Plain identifier, not a FK — the drones table belongs to Chirag and may
  // not exist when this service runs standalone.
  @Column({ name: 'assigned_drone_id', type: 'varchar', nullable: true })
  assignedDroneId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
