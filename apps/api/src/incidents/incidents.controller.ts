import { Body, Controller, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import { UpdateIncidentStatusDto } from './dto/update-incident-status.dto.js';
import { IncidentsService } from './incidents.service.js';

@Controller()
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get('incidents')
  findAll() {
    return this.incidents.findAll();
  }

  @Get('incidents/:id')
  findOne(@Param('id') id: string) {
    return this.incidents.findOne(id);
  }

  @Patch('incidents/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateIncidentStatusDto) {
    return this.incidents.updateStatus(id, dto.status, dto.distress_flag);
  }

  @Get('incidents/:id/priority-breakdown')
  async priorityBreakdown(@Param('id') id: string) {
    const breakdown = await this.incidents.priorityBreakdown(id);
    if (!breakdown) throw new NotFoundException(`No priority score recorded for incident ${id}`);
    return breakdown;
  }
}
