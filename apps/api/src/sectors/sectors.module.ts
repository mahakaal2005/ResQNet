import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from '../missions/entities/mission.entity.js';
import { Sector } from './entities/sector.entity.js';
import { SectorsController } from './sectors.controller.js';
import { SectorsService } from './sectors.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Sector, Mission])],
  controllers: [SectorsController],
  providers: [SectorsService],
  exports: [SectorsService],
})
export class SectorsModule {}
