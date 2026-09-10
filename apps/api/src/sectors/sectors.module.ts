import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { Mission } from '../missions/entities/mission.entity.js';
import { Sector } from './entities/sector.entity.js';
import { SectorsController } from './sectors.controller.js';
import { SectorsService } from './sectors.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Sector, Mission]), AuditModule],
  controllers: [SectorsController],
  providers: [SectorsService],
  exports: [SectorsService],
})
export class SectorsModule {}
