import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable, NotFoundException } from '@nestjs/common';

import { Step } from '@/database/entities/step.entity';
import { lockWorkstreamGraph } from '@/modules/project/repositories/lock-workstream-graph.query';

import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToStep = (step: Step, workstream: Workstream) => void;

@Injectable()
export class StepRepository extends EntityRepository<Step> {
  constructor(em: SqlEntityManager) {
    super(em, Step);
  }

  /** Applies `apply` to the step and its sibling graph, workstream row locked. */
  async updateLocked(
    id: string,
    apply: ApplyToStep,
  ): Promise<{ workstream: Workstream; step: Step }> {
    return this.em.transactional(async (em) => {
      const located = await this.lockGraphOf(em, id);

      apply(located.step, located.workstream);
      await em.flush();

      return located;
    });
  }

  /** Same lock as `updateLocked`; `apply` renumbers the siblings left behind. */
  async removeLocked(id: string, apply: ApplyToStep): Promise<Workstream> {
    return this.em.transactional(async (em) => {
      const { workstream, step } = await this.lockGraphOf(em, id);

      apply(step, workstream);
      em.remove(step);
      await em.flush();

      return workstream;
    });
  }

  private async lockGraphOf(
    em: SqlEntityManager,
    id: string,
  ): Promise<{ workstream: Workstream; step: Step }> {
    const unlocked = await em.findOneOrFail(
      Step,
      { id },
      { populate: ['workstream'] },
    );
    const workstream = await lockWorkstreamGraph(em, unlocked.workstream.id);
    const step = workstream.getSteps().find((sibling) => sibling.id === id);

    if (!step) {
      throw new NotFoundException(`Step ${id} no longer exists`);
    }

    return { workstream, step };
  }
}
