import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { Detection } from './geolocation-intake/entities/detection.entity.js';
import { Geolocation } from './geolocation-intake/entities/geolocation.entity.js';
import { GeolocationIntakeModule } from './geolocation-intake/geolocation-intake.module.js';
import { IncidentEvent } from './incidents/entities/incident-event.entity.js';
import { Incident } from './incidents/entities/incident.entity.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { PriorityScore } from './priority/entities/priority-score.entity.js';
import { PriorityModule } from './priority/priority.module.js';

// Charan owns auth/missions/operators/sectors/audit — not wired here yet
// since that module hasn't started. This app boots standalone against
// Rudra's five tables only, per the Week-1 "no blocking" design.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'resqnet',
      password: process.env.DB_PASSWORD ?? 'resqnet',
      database: process.env.DB_NAME ?? 'resqnet',
      entities: [Detection, Geolocation, Incident, IncidentEvent, PriorityScore],
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    EventEmitterModule.forRoot(),
    GeolocationIntakeModule,
    IncidentsModule,
    PriorityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
