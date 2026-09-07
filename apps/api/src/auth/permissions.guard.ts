import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';
import { PERMISSIONS_KEY } from './permissions.decorator.js';
import { can, type Permission } from './rbac.js';

/**
 * Enforces the role matrix in rbac.ts. Runs after JwtAuthGuard, which is what
 * puts `user` on the request.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required?.length) return true;

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (!user) throw new ForbiddenException('No authenticated user on the request');

    const missing = required.filter((permission) => !can(user.role, permission));
    if (missing.length) {
      throw new ForbiddenException(
        `Role "${user.role}" is missing permission(s): ${missing.join(', ')}`,
      );
    }

    return true;
  }
}
