import { Body, Controller, Get, NotFoundException, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { Permissions } from '../auth/permissions.decorator.js';
import { PermissionsGuard } from '../auth/permissions.guard.js';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto.js';
import { IncidentsService } from './incidents.service.js';

// GET endpoints are dashboard reads (viewer and up); the PATCH is an operator
// action, same tier as Charan's mission:update-status. POST /detections and
// POST /geolocations stay unauthenticated on GeolocationIntakeController --
// those are AI-service-to-backend ingest, not a logged-in human action, and
// no service-account auth scheme exists yet.
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get('incidents')
  @Permissions('incident:read')
  findAll() {
    return this.incidents.findAll();
  }

  @Get('incidents/:id')
  @Permissions('incident:read')
  findOne(@Param('id') id: string) {
    return this.incidents.findOne(id);
  }

  @Patch('incidents/:id/status')
  @Permissions('incident:update-status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto) {
    return this.incidents.updateStatus(id, dto.status, dto.distress_flag);
  }

  @Get('incidents/:id/priority-breakdown')
  @Permissions('incident:read')
  async priorityBreakdown(@Param('id') id: string) {
    const breakdown = await this.incidents.priorityBreakdown(id);
    if (!breakdown) throw new NotFoundException(`No priority score recorded for incident ${id}`);
    return breakdown;
  }
}
