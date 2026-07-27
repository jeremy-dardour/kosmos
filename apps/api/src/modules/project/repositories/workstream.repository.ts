import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Note } from '@/database/entities/note.entity';
import { Workstream } from '@/database/entities/workstream.entity';

const WORKSTREAM_POPULATE = [
  'owner',
  'group',
  'currentStep',
  'steps',
  'steps.owner',
  'steps.checklistItems',
] as const;

@Injectable()
export class WorkstreamRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findOne(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(Workstream, { id });
  }

  async findDetails(id: string): Promise<Workstream> {
    return this.em.findOneOrFail(
      Workstream,
      { id },
      { populate: [...WORKSTREAM_POPULATE], refresh: true },
    );
  }

  async save(workstream: Workstream): Promise<void> {
    this.em.persist(workstream);
    await this.em.flush();
  }

  async remove(id: string): Promise<void> {
    await this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(Workstream, { id });

      // The current-step FK is restrictive, so release it before cascading.
      workstream.currentStep = null;
      await em.flush();

      em.remove(workstream);
    });
  }

  async countNotesByStep(stepIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();

    if (stepIds.length === 0) {
      return counts;
    }

    const notes = await this.em.find(
      Note,
      { step: { $in: stepIds } },
      { fields: ['step'] },
    );

    for (const note of notes) {
      const stepId = note.step.id;
      counts.set(stepId, (counts.get(stepId) ?? 0) + 1);
    }

    return counts;
  }
}
