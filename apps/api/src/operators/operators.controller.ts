import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.config.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { ROLE_PERMISSIONS } from '../auth/rbac.js';

@Controller('operators')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OperatorsController {
  constructor(private readonly auth: AuthService) {}

  /**
   * The dashboard's "who am I and what may I do" call. Returning the
   * permission list — not just the role — lets Ayush hide controls the caller
   * cannot use without hard-coding the role matrix in the frontend.
   */
  @Get('me')
  @Permissions('operator:read-self')
  async me(@CurrentUser() caller?: AuthenticatedUser) {
    const user = caller ? await this.auth.findById(caller.id) : null;
    if (!user) throw new NotFoundException('Account no longer exists');

    return {
      id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role],
      created_at: user.createdAt,
    };
  }
}
