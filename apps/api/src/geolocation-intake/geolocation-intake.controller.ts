import { Body, Controller, Post } from '@nestjs/common';
import { DetectionDto } from './dto/detection.dto.js';
import { GeolocationResultDto } from './dto/geolocation-result.dto.js';
import { GeolocationIntakeService } from './geolocation-intake.service.js';

@Controller()
export class GeolocationIntakeController {
  constructor(private readonly intake: GeolocationIntakeService) {}

  @Post('detections')
  ingestDetection(@Body() dto: DetectionDto) {
    return this.intake.ingestDetection(dto);
  }

  @Post('geolocations')
  ingestGeolocation(@Body() dto: GeolocationResultDto) {
    return this.intake.ingestGeolocation(dto);
  }
}
