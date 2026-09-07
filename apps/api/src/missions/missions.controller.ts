import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.config.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CreateMissionDto } from './dto/create-mission.dto.js';
import { UpdateMissionStatusDto } from './dto/update-mission-status.dto.js';
import { MissionsService } from './missions.service.js';

@Controller('missions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MissionsController {
  constructor(private readonly missions: MissionsService) {}

  @Post()
  @Permissions('mission:create')
  create(@Body() dto: CreateMissionDto, @CurrentUser() user?: AuthenticatedUser) {
    return this.missions.create(dto, user);
  }

  @Get()
  @Permissions('mission:read')
  findAll() {
    return this.missions.findAll();
  }

  /** `:id` accepts the uuid or the external mission_id ('MISSION-DEMO-1'). */
  @Get(':id')
  @Permissions('mission:read')
  findOne(@Param('id') id: string) {
    return this.missions.findOne(id);
  }

  @Patch(':id/status')
  @Permissions('mission:update-status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMissionStatusDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.missions.updateStatus(id, dto.status, user);
  }
}
