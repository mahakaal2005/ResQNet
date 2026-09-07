import { describe, expect, it } from 'vitest';
import { can, ROLE_PERMISSIONS } from './rbac.js';
import { UserRole } from './entities/user.entity.js';

describe('rbac', () => {
  it('lets an operator run a mission', () => {
    expect(can('operator', 'mission:create')).toBe(true);
    expect(can('operator', 'mission:update-status')).toBe(true);
    expect(can('operator', 'sector:create')).toBe(true);
  });

  it('keeps a viewer strictly read-only', () => {
    expect(can('viewer', 'mission:read')).toBe(true);
    expect(can('viewer', 'sector:read')).toBe(true);
    expect(can('viewer', 'audit:read')).toBe(true);

    expect(can('viewer', 'mission:create')).toBe(false);
    expect(can('viewer', 'mission:update-status')).toBe(false);
    expect(can('viewer', 'sector:create')).toBe(false);
  });

  it('reserves user management to admin', () => {
    expect(can('admin', 'user:manage')).toBe(true);
    expect(can('operator', 'user:manage')).toBe(false);
    expect(can('viewer', 'user:manage')).toBe(false);
  });

  it('grants every role read access to its own operator profile', () => {
    for (const role of ['admin', 'operator', 'viewer'] as UserRole[]) {
      expect(can(role, 'operator:read-self')).toBe(true);
    }
  });

  it('nests the roles so admin is a superset of operator is a superset of viewer', () => {
    for (const p of ROLE_PERMISSIONS.viewer) expect(ROLE_PERMISSIONS.operator).toContain(p);
    for (const p of ROLE_PERMISSIONS.operator) expect(ROLE_PERMISSIONS.admin).toContain(p);
  });
});
