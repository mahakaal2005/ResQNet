import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt.config.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CreateSectorDto } from './dto/create-sector.dto.js';
import { toSectorResponse } from './sector.presenter.js';
import { SectorsService } from './sectors.service.js';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SectorsController {
  constructor(private readonly sectors: SectorsService) {}

  @Post('sectors')
  @Permissions('sector:create')
  async create(@Body() dto: CreateSectorDto, @CurrentUser() user?: AuthenticatedUser) {
    return toSectorResponse(
      await this.sectors.upsert(
        dto.mission_id,
        dto.sector_id,
        dto.polygon,
        dto.assigned_drone_id,
        user,
      ),
    );
  }

  // Lives here rather than on MissionsController so sectors never has to
  // import missions and missions never has to import sectors' controller —
  // one direction of dependency only (MissionsModule -> SectorsModule).
  @Get('missions/:id/sectors')
  @Permissions('sector:read')
  async findForMission(@Param('id') id: string) {
    return (await this.sectors.findForMission(id)).map(toSectorResponse);
  }
}
