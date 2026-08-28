import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorityModule } from '../priority/priority.module.js';
import { IncidentEvent } from './entities/incident-event.entity.js';
import { Incident } from './entities/incident.entity.js';
import { IncidentsController } from './incidents.controller.js';
import { IncidentsService } from './incidents.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, IncidentEvent]), PriorityModule],
  controllers: [IncidentsController],
  providers: [IncidentsService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
