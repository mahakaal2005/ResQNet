import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { toAuditLogResponse } from './audit.presenter.js';
import { AuditService } from './audit.service.js';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // GET /audit-logs?mission_id=MISSION-DEMO-1
  @Get()
  @Permissions('audit:read')
  async find(
    @Query('mission_id') missionId?: string,
    @Query('limit', new DefaultValuePipe(200), ParseIntPipe) limit?: number,
  ) {
    return (await this.audit.find(missionId, limit)).map(toAuditLogResponse);
  }
}
