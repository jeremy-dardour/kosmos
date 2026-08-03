import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Step } from '@/database/entities/step.entity';
import { lockWorkstreamGraphOfStep } from '@/modules/project/repositories/lock-workstream-graph.query';

import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToStep = (step: Step, workstream: Workstream) => void;

@Injectable()
export class StepRepository extends EntityRepository<Step> {
  constructor(em: SqlEntityManager) {
    super(em, Step);
  }

  /**
   * Applies `apply` to the step and its sibling graph, workstream row locked.
   * Every locked write touches the root — a child edit alone would leave the
   * aggregate's `updatedAt` stale.
   */
  async updateLocked(
    id: string,
    apply: ApplyToStep,
  ): Promise<{ workstream: Workstream; step: Step }> {
    return this.em.transactional(async (em) => {
      const located = await lockWorkstreamGraphOfStep(em, id);

      apply(located.step, located.workstream);
      located.workstream.touch();
      await em.flush();

      return located;
    });
  }

  /** Same lock as `updateLocked`; `apply` renumbers the siblings left behind. */
  async removeLocked(id: string, apply: ApplyToStep): Promise<Workstream> {
    return this.em.transactional(async (em) => {
      const { workstream, step } = await lockWorkstreamGraphOfStep(em, id);

      apply(step, workstream);
      workstream.touch();
      em.remove(step);
      await em.flush();

      return workstream;
    });
  }
}
