import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * RBAC roles. Mapped to the beneficiaries in PRD Section 6:
 * - admin    provisions missions and manages operator accounts
 * - operator runs missions and confirms incidents (the demo's main actor)
 * - viewer   read-only district / authority account
 */
export type UserRole = 'admin' | 'operator' | 'viewer';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  email!: string;

  // select: false so the hash never rides along on an ordinary find() and can
  // never be serialised into an API response by accident. The login path opts
  // back in explicitly with addSelect().
  @Column({ name: 'password_hash', select: false })
  passwordHash!: string;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column({ type: 'varchar', default: 'operator' })
  role!: UserRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
