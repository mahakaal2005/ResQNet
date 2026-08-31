import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { GeoJsonPolygon } from '../../sectors/sector-geometry.js';

export type MissionStatus = 'created' | 'active' | 'paused' | 'completed';

@Entity('missions')
@Index(['status'])
export class Mission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // External identifier ('MISSION-DEMO-1'). Everything off-box refers to a
  // mission by this, not by the surrogate uuid — including Chirag's gateway,
  // which already emits mission_id on the mission.started event.
  @Column({ name: 'mission_id', unique: true })
  missionId!: string;

  @Column()
  name!: string;

  @Column({ type: 'varchar', default: 'created' })
  status!: MissionStatus;

  @Column({
    name: 'zone_polygon',
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
  })
  zonePolygon!: GeoJsonPolygon;

  @Column({ name: 'sector_count', type: 'int' })
  sectorCount!: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
