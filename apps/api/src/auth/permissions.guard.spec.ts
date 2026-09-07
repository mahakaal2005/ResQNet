import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import type { UserRole } from './entities/user.entity.js';
import { PermissionsGuard } from './permissions.guard.js';
import type { Permission } from './rbac.js';

function contextFor(role: UserRole | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => (role ? { user: { id: 'u1', email: 'u@x', role } } : {}),
    }),
    getHandler: () => () => {},
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guardRequiring(...permissions: Permission[]): PermissionsGuard {
  const reflector = { getAllAndOverride: () => permissions } as unknown as Reflector;
  return new PermissionsGuard(reflector);
}

describe('PermissionsGuard', () => {
  it('lets an operator create a mission', () => {
    expect(guardRequiring('mission:create').canActivate(contextFor('operator'))).toBe(true);
  });

  it('blocks a viewer from creating a mission or changing its status', () => {
    for (const permission of ['mission:create', 'mission:update-status'] as Permission[]) {
      expect(() => guardRequiring(permission).canActivate(contextFor('viewer'))).toThrow(
        ForbiddenException,
      );
    }
  });

  it('lets a viewer read missions and the audit log', () => {
    expect(guardRequiring('mission:read', 'audit:read').canActivate(contextFor('viewer'))).toBe(
      true,
    );
  });

  it('requires every listed permission, not just one of them', () => {
    expect(() =>
      guardRequiring('mission:read', 'user:manage').canActivate(contextFor('operator')),
    ).toThrow(ForbiddenException);
  });

  it('lets an unguarded route through', () => {
    expect(guardRequiring().canActivate(contextFor('viewer'))).toBe(true);
  });

  it('refuses when no authenticated user reached the request', () => {
    expect(() => guardRequiring('mission:read').canActivate(contextFor(null))).toThrow(
      ForbiddenException,
    );
  });
});
