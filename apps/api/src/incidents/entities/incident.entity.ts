import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type IncidentStatus = 'open' | 'confirmed' | 'dispatched' | 'resolved';

export interface IncidentEvidence {
  frame_ref: string;
  detection_id: string;
}

@Entity('incidents')
@Index(['status'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'incident_id', unique: true })
  incidentId!: string;

  @Column({ type: 'float' })
  latitude!: number;

  @Column({ type: 'float' })
  longitude!: number;

  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: { type: 'Point'; coordinates: [number, number] } | null;

  @Column({ name: 'survivor_count_estimate', type: 'int' })
  survivorCountEstimate!: number;

  @Column({ type: 'float' })
  confidence!: number;

  @Column({ name: 'priority_score', type: 'int', default: 0 })
  priorityScore!: number;

  @Column({ type: 'varchar', default: 'open' })
  status!: IncidentStatus;

  @Column({ name: 'first_seen', type: 'timestamptz' })
  firstSeen!: Date;

  @Column({ name: 'last_seen', type: 'timestamptz' })
  lastSeen!: Date;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence!: IncidentEvidence[];

  @Column({ name: 'source_drones', type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  sourceDrones!: string[];

  @Column({ name: 'sector_id' })
  sectorId!: string;

  @Column({ name: 'operator_confirmed', type: 'boolean', default: false })
  operatorConfirmed!: boolean;

  @Column({ name: 'distress_flag', type: 'boolean', default: false })
  distressFlag!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
