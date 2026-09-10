import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PriorityScore } from './entities/priority-score.entity.js';
import { computePriorityScore, PriorityBreakdown, PriorityInput } from './priority-engine.js';

@Injectable()
export class PriorityService {
  constructor(
    @InjectRepository(PriorityScore)
    private readonly priorityScores: Repository<PriorityScore>,
  ) {}

  async scoreAndPersist(
    incidentId: string,
    input: PriorityInput,
  ): Promise<PriorityBreakdown> {
    const breakdown = computePriorityScore(input);

    await this.priorityScores.save(
      this.priorityScores.create({
        incidentId,
        peopleCount: breakdown.people_count,
        isolation: breakdown.isolation,
        timeFactor: breakdown.time_factor,
        distressFlag: breakdown.distress_flag,
        total: breakdown.total,
      }),
    );

    return breakdown;
  }

  async latestBreakdown(incidentId: string): Promise<PriorityBreakdown | null> {
    const latest = await this.priorityScores.findOne({
      where: { incidentId },
      order: { createdAt: 'DESC' },
    });

    if (!latest) return null;

    return {
      people_count: latest.peopleCount,
      isolation: latest.isolation,
      time_factor: latest.timeFactor,
      distress_flag: latest.distressFlag,
      total: latest.total,
    };
  }
}
