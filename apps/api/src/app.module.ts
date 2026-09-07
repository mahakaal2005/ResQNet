import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuditModule } from './audit/audit.module.js';
import { AuditLog } from './audit/entities/audit-log.entity.js';
import { AuthModule } from './auth/auth.module.js';
import { User } from './auth/entities/user.entity.js';
import { Detection } from './geolocation-intake/entities/detection.entity.js';
import { Geolocation } from './geolocation-intake/entities/geolocation.entity.js';
import { GeolocationIntakeModule } from './geolocation-intake/geolocation-intake.module.js';
import { IncidentEvent } from './incidents/entities/incident-event.entity.js';
import { Incident } from './incidents/entities/incident.entity.js';
import { IncidentsModule } from './incidents/incidents.module.js';
import { Mission } from './missions/entities/mission.entity.js';
import { MissionsModule } from './missions/missions.module.js';
import { OperatorsModule } from './operators/operators.module.js';
import { PriorityScore } from './priority/entities/priority-score.entity.js';
import { PriorityModule } from './priority/priority.module.js';
import { Sector } from './sectors/entities/sector.entity.js';
import { SectorsModule } from './sectors/sectors.module.js';

// One deployable service, two owners, non-overlapping module folders
// (Section 12): Charan owns auth/missions/operators/sectors/audit, Rudra owns
// geolocation-intake/incidents/priority. Either half boots without the other's
// tables being populated — nothing here cross-imports across that line.
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USER ?? 'resqnet',
      password: process.env.DB_PASSWORD ?? 'resqnet',
      database: process.env.DB_NAME ?? 'resqnet',
      entities: [
        // Charan — migration 0002
        User,
        Mission,
        Sector,
        AuditLog,
        // Rudra — migration 0001
        Detection,
        Geolocation,
        Incident,
        IncidentEvent,
        PriorityScore,
      ],
      // database/migrations/** is the schema of record; set DB_SYNCHRONIZE=false
      // (docker-compose does) whenever the migrations have been applied.
      synchronize: process.env.DB_SYNCHRONIZE
        ? process.env.DB_SYNCHRONIZE === 'true'
        : process.env.NODE_ENV !== 'production',
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    MissionsModule,
    SectorsModule,
    OperatorsModule,
    AuditModule,
    GeolocationIntakeModule,
    IncidentsModule,
    PriorityModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
