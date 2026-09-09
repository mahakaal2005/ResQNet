import { UserRole } from './entities/user.entity.js';

/**
 * Permissions are named after the action they guard, not the endpoint, so a
 * route can move without the matrix changing.
 *
 * The meaningful line in Phase 1 is viewer vs the rest: PRD Section 6 lists
 * district disaster-management authorities as needing "a shared geographical
 * view", i.e. read access with no ability to alter a live mission.
 */
export type Permission =
  | 'mission:create'
  | 'mission:read'
  | 'mission:update-status'
  | 'sector:create'
  | 'sector:read'
  | 'audit:read'
  | 'operator:read-self'
  | 'user:manage'
  // Rudra (intelligence) — additive only, cross-owner edit, flagged for
  // Charan's review. Confirming/dispatching an incident is the same kind of
  // operator action as mission:update-status, so it follows the same rule.
  | 'incident:read'
  | 'incident:update-status';

const VIEWER: Permission[] = [
  'mission:read',
  'sector:read',
  'audit:read',
  'operator:read-self',
  'incident:read',
];

// Section 27 step 1 puts the operator in the driving seat ("operator draws
// disaster zone"), so creating missions and sectors is an operator power, not
// an admin-only one.
const OPERATOR: Permission[] = [
  ...VIEWER,
  'mission:create',
  'mission:update-status',
  'sector:create',
  'incident:update-status',
];

const ADMIN: Permission[] = [...OPERATOR, 'user:manage'];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  viewer: VIEWER,
  operator: OPERATOR,
  admin: ADMIN,
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
