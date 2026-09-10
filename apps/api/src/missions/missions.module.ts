import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module.js';
import { SectorsModule } from '../sectors/sectors.module.js';
import { Mission } from './entities/mission.entity.js';
import { MissionRealtimePublisher } from './mission-realtime.publisher.js';
import { MissionsController } from './missions.controller.js';
import { MissionsService } from './missions.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Mission]), SectorsModule, AuditModule],
  controllers: [MissionsController],
  providers: [
    MissionsService,
    // useFactory, not the class directly: the publisher's constructor takes
    // its config as defaulted parameters so tests can pass a fake socket, and
    // Nest would otherwise try to resolve those as providers. EventEmitter2
    // still discovers the @OnEvent handlers on the instance.
    { provide: MissionRealtimePublisher, useFactory: () => new MissionRealtimePublisher() },
  ],
  exports: [MissionsService],
})
export class MissionsModule {}
