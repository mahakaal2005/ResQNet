/**
 * One place for the token settings so the guard, the service and the tests
 * cannot drift apart.
 *
 * There is no refresh_tokens table (Section 11 assigns this track exactly four
 * tables), so the refresh token is a stateless JWT distinguished from an
 * access token only by its `typ` claim. Both are re-validated against the
 * users row on every refresh, which is what makes a role change or a deleted
 * account take effect without server-side session storage.
 */
import type { JwtSignOptions } from '@nestjs/jwt';

/** What jsonwebtoken accepts for expiresIn: seconds, or a span like '15m'. */
type Expiry = NonNullable<JwtSignOptions['expiresIn']>;

export const JWT_SECRET = process.env.JWT_SECRET ?? 'resqnet-dev-secret-change-me';
export const ACCESS_TOKEN_TTL = (process.env.JWT_ACCESS_TTL ?? '15m') as Expiry;
export const REFRESH_TOKEN_TTL = (process.env.JWT_REFRESH_TTL ?? '7d') as Expiry;

export type TokenType = 'access' | 'refresh';

export interface JwtPayload {
  /** users.id */
  sub: string;
  email: string;
  role: string;
  typ: TokenType;
}

/** What the guards attach to the request, and what @CurrentUser() hands a controller. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: import('./entities/user.entity.js').UserRole;
}
