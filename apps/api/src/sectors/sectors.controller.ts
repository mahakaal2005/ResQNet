import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { CreateSectorDto } from './dto/create-sector.dto.js';
import { SectorsService } from './sectors.service.js';

@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SectorsController {
  constructor(private readonly sectors: SectorsService) {}

  @Post('sectors')
  @Permissions('sector:create')
  create(@Body() dto: CreateSectorDto) {
    return this.sectors.upsert(
      dto.mission_id,
      dto.sector_id,
      dto.polygon,
      dto.assigned_drone_id,
    );
  }

  // Lives here rather than on MissionsController so sectors never has to
  // import missions and missions never has to import sectors' controller —
  // one direction of dependency only (MissionsModule -> SectorsModule).
  @Get('missions/:id/sectors')
  @Permissions('sector:read')
  findForMission(@Param('id') id: string) {
    return this.sectors.findForMission(id);
  }
}
