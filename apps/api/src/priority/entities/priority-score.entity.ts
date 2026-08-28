import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('priority_scores')
export class PriorityScore {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'incident_id' })
  incidentId!: string;

  @Column({ name: 'people_count', type: 'int' })
  peopleCount!: number;

  @Column({ type: 'int' })
  isolation!: number;

  @Column({ name: 'time_factor', type: 'int' })
  timeFactor!: number;

  @Column({ name: 'distress_flag', type: 'int' })
  distressFlag!: number;

  @Column({ type: 'int' })
  total!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
