import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IncidentsModule } from '../incidents/incidents.module.js';
import { Detection } from './entities/detection.entity.js';
import { Geolocation } from './entities/geolocation.entity.js';
import { GeolocationIntakeController } from './geolocation-intake.controller.js';
import { GeolocationIntakeService } from './geolocation-intake.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Detection, Geolocation]), IncidentsModule],
  controllers: [GeolocationIntakeController],
  providers: [GeolocationIntakeService],
})
export class GeolocationIntakeModule {}
