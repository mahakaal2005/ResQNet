import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('incident_events')
export class IncidentEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'incident_id' })
  incidentId!: string;

  @Column({ name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
