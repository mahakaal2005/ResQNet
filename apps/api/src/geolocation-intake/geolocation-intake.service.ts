import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from '../incidents/entities/incident.entity.js';
import { IncidentsService } from '../incidents/incidents.service.js';
import { DetectionDto } from './dto/detection.dto.js';
import { GeolocationResultDto } from './dto/geolocation-result.dto.js';
import { Detection } from './entities/detection.entity.js';
import { Geolocation } from './entities/geolocation.entity.js';

@Injectable()
export class GeolocationIntakeService {
  constructor(
    @InjectRepository(Detection)
    private readonly detections: Repository<Detection>,
    @InjectRepository(Geolocation)
    private readonly geolocations: Repository<Geolocation>,
    private readonly incidentsService: IncidentsService,
  ) {}

  async ingestDetection(dto: DetectionDto): Promise<Detection> {
    const existing = await this.detections.findOne({
      where: { detectionId: dto.detection_id },
    });
    if (existing) {
      throw new ConflictException(`Detection ${dto.detection_id} already ingested`);
    }

    const detection = this.detections.create({
      detectionId: dto.detection_id,
      droneId: dto.drone_id,
      sectorId: dto.sector_id,
      timestamp: new Date(dto.timestamp),
      bbox: dto.bbox,
      confidence: dto.confidence,
      centroid: dto.centroid,
    });

    return this.detections.save(detection);
  }

  /**
   * Geolocation results reference a detection by detection_id. Once both
   * halves exist, this is the trigger point that hands off to IncidentsService
   * to run dedup + scoring — the bridge from raw AI output to intelligence.
   */
  async ingestGeolocation(dto: GeolocationResultDto): Promise<{
    geolocation: Geolocation;
    incident: Incident;
  }> {
    const detection = await this.detections.findOne({
      where: { detectionId: dto.detection_id },
    });
    if (!detection) {
      throw new NotFoundException(
        `No detection ${dto.detection_id} found — POST /detections first`,
      );
    }

    const geolocation = await this.geolocations.save(
      this.geolocations.create({
        detectionId: dto.detection_id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        errorM: dto.error_m,
        method: dto.method,
        location: { type: 'Point', coordinates: [dto.longitude, dto.latitude] },
      }),
    );

    const incident = await this.incidentsService.ingestDetectionGeolocation(
      detection,
      geolocation,
    );

    return { geolocation, incident };
  }
}
