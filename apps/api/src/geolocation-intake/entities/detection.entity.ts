import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('detections')
@Index(['droneId', 'timestamp'])
export class Detection {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'detection_id', unique: true })
  detectionId!: string;

  @Column({ name: 'drone_id' })
  droneId!: string;

  @Column({ name: 'sector_id' })
  sectorId!: string;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'jsonb' })
  bbox!: { x: number; y: number; w: number; h: number };

  @Column({ type: 'float' })
  confidence!: number;

  @Column({ type: 'jsonb' })
  centroid!: { x: number; y: number };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
