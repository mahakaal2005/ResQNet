import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Sector } from '../sectors/entities/sector.entity.js';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { AuditLog } from './entities/audit-log.entity.js';
import { IncidentAuditListener } from './incident-audit.listener.js';

// Sector is registered for reading only — incident-audit.listener.ts maps a
// sector label back to its mission. SectorsModule is deliberately not imported:
// it imports AuditModule, and this keeps that dependency one-directional.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog, Sector])],
  controllers: [AuditController],
  providers: [AuditService, IncidentAuditListener],
  exports: [AuditService],
})
export class AuditModule {}
