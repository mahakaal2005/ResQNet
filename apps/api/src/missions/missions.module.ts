import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { SectorsModule } from '../sectors/sectors.module.js';
import { Mission } from './entities/mission.entity.js';
import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Mission]), SectorsModule, AuditModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
