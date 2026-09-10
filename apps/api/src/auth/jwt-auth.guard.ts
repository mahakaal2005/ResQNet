import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { UserRole } from './entities/user.entity.js';
import type { AuthenticatedUser, JwtPayload } from './jwt.config.js';

/** The request once JwtAuthGuard has run. */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Verifies the Bearer access token and attaches the caller to the request.
 *
 * Deliberately not Passport: one guard reading one header is less machinery
 * than a strategy plus its plumbing, and the plan's priority order puts
 * Simplicity first.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');

    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    // A refresh token must not open a door an access token opens; it is only
    // ever accepted by POST /auth/refresh.
    if (payload.typ !== 'access') {
      throw new UnauthorizedException('A refresh token cannot authorise a request');
    }

    request.user = { id: payload.sub, email: payload.email, role: payload.role as UserRole };
    return true;
  }
}
