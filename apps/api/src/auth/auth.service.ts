import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service.js';
import { User } from './entities/user.entity.js';
import {
  ACCESS_TOKEN_TTL,
  AuthenticatedUser,
  JwtPayload,
  REFRESH_TOKEN_TTL,
} from './jwt.config.js';
import { verifyPassword } from './password.js';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  expires_in: string;
  user: AuthenticatedUser;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async login(email: string, password: string): Promise<TokenPair> {
    // passwordHash is `select: false` on the entity, so it has to be asked for
    // explicitly here — the one place in the codebase that may see it.
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    // Same message and same work either way: an attacker learns nothing about
    // which addresses have accounts.
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      await this.audit.record({ action: 'auth.login_failed', entityType: 'user', payload: { email } });
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.audit.record({
      action: 'auth.login',
      actorUserId: user.id,
      entityType: 'user',
      entityId: user.id,
      payload: { email: user.email, role: user.role },
    });

    return this.issueTokens(user);
  }

  /**
   * Trades a refresh token for a fresh pair. The users row is re-read rather
   * than trusting the claims, so a role change or a deleted account takes
   * effect on the next refresh even though nothing is stored server-side.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    if (payload.typ !== 'refresh') {
      throw new UnauthorizedException('An access token cannot be used to refresh a session');
    }

    const user = await this.users.findOne({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException('Account no longer exists');

    return this.issueTokens(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.users.findOne({ where: { id } });
  }

  private async issueTokens(user: User): Promise<TokenPair> {
    const claims = { sub: user.id, email: user.email, role: user.role };

    const [access_token, refresh_token] = await Promise.all([
      this.jwt.signAsync({ ...claims, typ: 'access' }, { expiresIn: ACCESS_TOKEN_TTL }),
      this.jwt.signAsync({ ...claims, typ: 'refresh' }, { expiresIn: REFRESH_TOKEN_TTL }),
    ]);

    return {
      access_token,
      refresh_token,
      token_type: 'Bearer',
      expires_in: String(ACCESS_TOKEN_TTL),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
