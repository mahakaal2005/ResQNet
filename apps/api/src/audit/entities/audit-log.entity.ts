import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
@Index(['missionId', 'timestamp'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Nullable: not every audited action is mission-scoped (a login is not).
  @Column({ name: 'mission_id', type: 'varchar', nullable: true })
  missionId!: string | null;

  // Nullable so the system itself can be the actor for events with no human
  // behind them, such as an automatic resync.
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @Column()
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType!: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  timestamp!: Date;
}
