import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuditService } from '../audit/audit.service.js';
import { AuthService } from './auth.service.js';
import { User } from './entities/user.entity.js';
import { JWT_SECRET, type JwtPayload } from './jwt.config.js';
import { hashPassword } from './password.js';

const PASSWORD = 'resqnet-demo';

/**
 * A repository stand-in rather than a database: these tests are about token
 * issuance and expiry, and the persistence path is covered for real by
 * test/backend-core.e2e-spec.ts against Postgres.
 */
function fakeUserRepository(users: User[]): Repository<User> {
  return {
    createQueryBuilder: () => {
      let email = '';
      const builder = {
        addSelect: () => builder,
        where: (_clause: string, params: { email: string }) => {
          email = params.email;
          return builder;
        },
        getOne: async () => users.find((u) => u.email === email) ?? null,
      };
      return builder;
    },
    findOne: async ({ where }: { where: { id: string } }) =>
      users.find((u) => u.id === where.id) ?? null,
  } as unknown as Repository<User>;
}

const noopAudit = { record: async () => {} } as unknown as AuditService;

describe('AuthService', () => {
  const jwt = new JwtService({ secret: JWT_SECRET });
  let operator: User;
  let service: AuthService;

  beforeEach(async () => {
    operator = {
      id: '00000000-0000-4000-8000-000000000002',
      email: 'operator@resqnet.demo',
      passwordHash: await hashPassword(PASSWORD),
      fullName: 'Sector Operator',
      role: 'operator',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    service = new AuthService(fakeUserRepository([operator]), jwt, noopAudit);
  });

  it('issues an access and a refresh token that carry the caller identity', async () => {
    const tokens = await service.login(operator.email, PASSWORD);

    const access = jwt.verify<JwtPayload>(tokens.access_token);
    expect(access).toMatchObject({ sub: operator.id, email: operator.email, role: 'operator', typ: 'access' });

    const refresh = jwt.verify<JwtPayload>(tokens.refresh_token);
    expect(refresh.typ).toBe('refresh');
    expect(tokens.token_type).toBe('Bearer');
  });

  it('never returns the password hash to the caller', async () => {
    const tokens = await service.login(operator.email, PASSWORD);
    expect(JSON.stringify(tokens)).not.toContain(operator.passwordHash);
    expect(tokens.user).toEqual({ id: operator.id, email: operator.email, role: 'operator' });
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    await expect(service.login(operator.email, 'wrong')).rejects.toThrow(UnauthorizedException);
    await expect(service.login('nobody@resqnet.demo', PASSWORD)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('expires an access token — the expiry claim is enforced, not decorative', async () => {
    const expired = jwt.sign(
      { sub: operator.id, email: operator.email, role: 'operator', typ: 'access' },
      { expiresIn: '-1s' },
    );
    expect(() => jwt.verify(expired)).toThrow();
  });

  it('trades a refresh token for a fresh pair', async () => {
    const first = await service.login(operator.email, PASSWORD);
    const second = await service.refresh(first.refresh_token);

    expect(jwt.verify<JwtPayload>(second.access_token).typ).toBe('access');
    expect(second.user.id).toBe(operator.id);
  });

  it('refuses an access token, an expired refresh token and a forged one at /auth/refresh', async () => {
    const { access_token } = await service.login(operator.email, PASSWORD);
    await expect(service.refresh(access_token)).rejects.toThrow(UnauthorizedException);

    const expired = jwt.sign(
      { sub: operator.id, email: operator.email, role: 'operator', typ: 'refresh' },
      { expiresIn: '-1s' },
    );
    await expect(service.refresh(expired)).rejects.toThrow(UnauthorizedException);

    const forged = new JwtService({ secret: 'not-the-real-secret' }).sign({
      sub: operator.id,
      email: operator.email,
      role: 'admin',
      typ: 'refresh',
    });
    await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException);
  });

  it('re-reads the user on refresh, so a deleted account cannot keep a session alive', async () => {
    const { refresh_token } = await service.login(operator.email, PASSWORD);
    service = new AuthService(fakeUserRepository([]), jwt, noopAudit);
    await expect(service.refresh(refresh_token)).rejects.toThrow(UnauthorizedException);
  });
});
