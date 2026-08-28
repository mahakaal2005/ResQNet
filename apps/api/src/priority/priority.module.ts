import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriorityScore } from './entities/priority-score.entity.js';
import { PriorityService } from './priority.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([PriorityScore])],
  providers: [PriorityService],
  exports: [PriorityService],
})
export class PriorityModule {}
