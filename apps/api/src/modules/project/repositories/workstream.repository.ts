import { EntityRepository, LockMode } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';

export interface LockedWorkstreamChanges {
  removedSteps?: Step[];
  removedChecklistItems?: ChecklistItem[];
}

const WORKSTREAM_POPULATE = [
  'owner',
  'group',
  'currentStep',
  'steps',
  'steps.owner',
  'steps.checklistItems',
] as const;

@Injectable()
export class WorkstreamRepository extends EntityRepository<Workstream> {
  constructor(em: SqlEntityManager) {
    super(em, Workstream);
  }

  async findDetails(id: string): Promise<Workstream> {
    return this.findOneOrFail(
      { id },
      { populate: [...WORKSTREAM_POPULATE], refresh: true },
    );
  }

  async save(workstream: Workstream): Promise<void> {
    this.em.persist(workstream);
    await this.em.flush();
  }

  async updateLockedDetails(
    id: string,
    apply: (
      workstream: Workstream,
    ) => LockedWorkstreamChanges | undefined | void,
  ): Promise<Workstream> {
    return this.em.transactional(async (em) => {
      const workstream = await em.findOneOrFail(
        Workstream,
        { id },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      await em.populate(workstream, [...WORKSTREAM_POPULATE]);

      const changes = apply(workstream);
      if (changes?.removedChecklistItems) {
        em.remove(changes.removedChecklistItems);
      }
      if (changes?.removedSteps) {
        em.remove(changes.removedSteps);
      }
      await em.flush();

      return workstream;
    });
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
}
