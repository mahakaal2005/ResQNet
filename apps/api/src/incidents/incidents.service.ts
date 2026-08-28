import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { Detection } from '../geolocation-intake/entities/detection.entity.js';
import { Geolocation } from '../geolocation-intake/entities/geolocation.entity.js';
import { PriorityService } from '../priority/priority.service.js';
import { DedupCandidate, findDuplicateIncident } from './dedup.js';
import { IncidentEvent } from './entities/incident-event.entity.js';
import { Incident, IncidentStatus } from './entities/incident.entity.js';
import { assertValidTransition, InvalidIncidentTransitionError } from './incident-state-machine.js';

// Placeholder until a road/access-point dataset is wired in (Phase 1 has no
// such dataset). Documented in docs/contracts/priority-weights.md.
const DEFAULT_ISOLATION_SCORE = 0.5;

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidents: Repository<Incident>,
    @InjectRepository(IncidentEvent)
    private readonly incidentEvents: Repository<IncidentEvent>,
    private readonly priorityService: PriorityService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Called once a Detection and its matching Geolocation Result are both
   * available. Runs dedup, creates or updates the incident, and rescoring
   * priority — this is the heart of Rudra's ownership.
   */
  async ingestDetectionGeolocation(
    detection: Detection,
    geolocation: Geolocation,
  ): Promise<Incident> {
    const candidate: DedupCandidate = {
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      timestamp: detection.timestamp,
    };

    const openIncidents = await this.incidents.find({
      where: { status: 'open', sectorId: detection.sectorId },
    });

    const match = findDuplicateIncident(candidate, openIncidents);

    const incident = match
      ? await this.mergeIntoExisting(match, detection, geolocation)
      : await this.createIncident(detection, geolocation);

    await this.rescorePriority(incident);

    return incident;
  }

  private async createIncident(
    detection: Detection,
    geolocation: Geolocation,
  ): Promise<Incident> {
    const incident = this.incidents.create({
      incidentId: `INC-${randomUUID().slice(0, 8).toUpperCase()}`,
      latitude: geolocation.latitude,
      longitude: geolocation.longitude,
      location: {
        type: 'Point',
        coordinates: [geolocation.longitude, geolocation.latitude],
      },
      survivorCountEstimate: 1,
      confidence: detection.confidence,
      priorityScore: 0,
      status: 'open',
      firstSeen: detection.timestamp,
      lastSeen: detection.timestamp,
      evidence: [{ frame_ref: detection.detectionId, detection_id: detection.detectionId }],
      sourceDrones: [detection.droneId],
      sectorId: detection.sectorId,
      operatorConfirmed: false,
      distressFlag: false,
    });

    const saved = await this.incidents.save(incident);
    await this.logEvent(saved.incidentId, 'incident.created', { detection_id: detection.detectionId });
    this.events.emit('incident.created', saved);
    return saved;
  }

  private async mergeIntoExisting(
    incident: Incident,
    detection: Detection,
    geolocation: Geolocation,
  ): Promise<Incident> {
    incident.lastSeen = detection.timestamp;
    incident.confidence = Math.max(incident.confidence, detection.confidence);
    incident.latitude = geolocation.latitude;
    incident.longitude = geolocation.longitude;
    incident.location = {
      type: 'Point',
      coordinates: [geolocation.longitude, geolocation.latitude],
    };
    incident.evidence = [
      ...incident.evidence,
      { frame_ref: detection.detectionId, detection_id: detection.detectionId },
    ];
    if (!incident.sourceDrones.includes(detection.droneId)) {
      incident.sourceDrones = [...incident.sourceDrones, detection.droneId];
      incident.survivorCountEstimate += 1;
    }

    const saved = await this.incidents.save(incident);
    await this.logEvent(saved.incidentId, 'incident.updated', {
      detection_id: detection.detectionId,
      merged: true,
    });
    this.events.emit('incident.updated', saved);
    return saved;
  }

  private async rescorePriority(incident: Incident): Promise<void> {
    const minutesSinceLastMovement =
      (incident.lastSeen.getTime() - incident.firstSeen.getTime()) / 60_000;

    const breakdown = await this.priorityService.scoreAndPersist(incident.incidentId, {
      peopleCount: incident.survivorCountEstimate,
      isolationScore: DEFAULT_ISOLATION_SCORE,
      minutesSinceLastMovement,
      distressFlag: incident.distressFlag,
    });

    incident.priorityScore = breakdown.total;
    await this.incidents.save(incident);

    await this.logEvent(incident.incidentId, 'incident.priority_changed', { ...breakdown });
    this.events.emit('incident.priority_changed', { incidentId: incident.incidentId, breakdown });
  }

  async findAll(): Promise<Incident[]> {
    return this.incidents.find({ order: { priorityScore: 'DESC' } });
  }

  async findOne(incidentId: string): Promise<Incident> {
    const incident = await this.incidents.findOne({ where: { incidentId } });
    if (!incident) throw new NotFoundException(`Incident ${incidentId} not found`);
    return incident;
  }

  async updateStatus(
    incidentId: string,
    nextStatus: IncidentStatus,
    distressFlag?: boolean,
  ): Promise<Incident> {
    const incident = await this.findOne(incidentId);
    try {
      assertValidTransition(incident.status, nextStatus);
    } catch (err) {
      if (err instanceof InvalidIncidentTransitionError) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }

    incident.status = nextStatus;
    incident.operatorConfirmed = nextStatus !== 'open';
    const distressChanged =
      distressFlag !== undefined && distressFlag !== incident.distressFlag;
    if (distressFlag !== undefined) incident.distressFlag = distressFlag;

    const saved = await this.incidents.save(incident);
    await this.logEvent(saved.incidentId, 'incident.updated', { status: nextStatus });
    this.events.emit('incident.updated', saved);

    if (distressChanged) {
      await this.rescorePriority(saved);
    }

    return saved;
  }

  async priorityBreakdown(incidentId: string) {
    await this.findOne(incidentId); // 404s if missing
    return this.priorityService.latestBreakdown(incidentId);
  }

  private async logEvent(
    incidentId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.incidentEvents.save(
      this.incidentEvents.create({ incidentId, eventType, payload }),
    );
  }
}
