import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { User } from './entities/user.entity.js';
import { JWT_SECRET } from './jwt.config.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { PermissionsGuard } from './permissions.guard.js';

/**
 * Global so every other module can hang JwtAuthGuard/PermissionsGuard on its
 * routes without re-importing auth — the guards are cross-cutting, not a
 * dependency of any one feature.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({ secret: JWT_SECRET }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard, JwtModule],
})
export class AuthModule {}
