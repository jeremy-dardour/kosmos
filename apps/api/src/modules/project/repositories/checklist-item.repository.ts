import { NotFoundError } from '@mikro-orm/core';
import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { lockWorkstreamGraphOfStep } from '@/modules/project/repositories/lock-workstream-graph.query';
import { memberProject } from '@/modules/project/repositories/membership.query';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToItem = (item: ChecklistItem, workstream: Workstream) => void;

/**
 * Every mutation takes the parent workstream's row lock: the item positions
 * renumber, and the mutability guards must read committed sibling state.
 */
@Injectable()
export class ChecklistItemRepository extends EntityRepository<ChecklistItem> {
  constructor(em: SqlEntityManager) {
    super(em, ChecklistItem);
  }

  /**
   * `build` returns the new item, appended to the locked step. Every locked
   * write touches the root — a child edit alone would leave the aggregate's
   * `updatedAt` stale.
   */
  async createLocked(
    stepId: string,
    actorId: string,
    build: (step: Step, workstream: Workstream) => ChecklistItem,
  ): Promise<ChecklistItem> {
    return this.em.transactional(async (em) => {
      const { workstream, step } = await lockWorkstreamGraphOfStep(
        em,
        stepId,
        actorId,
      );

      const item = build(step, workstream);
      workstream.touch();
      em.persist(item);
      await em.flush();

      return item;
    });
  }

  async updateLocked(
    id: string,
    actorId: string,
    apply: ApplyToItem,
  ): Promise<ChecklistItem> {
    return this.em.transactional(async (em) => {
      const { workstream, item } = await this.lockGraphOf(em, id, actorId);

      apply(item, workstream);
      workstream.touch();
      await em.flush();

      return item;
    });
  }

  /** Same lock as `updateLocked`; `apply` renumbers the siblings left behind. */
  async removeLocked(
    id: string,
    actorId: string,
    apply: ApplyToItem,
  ): Promise<void> {
    await this.em.transactional(async (em) => {
      const { workstream, item } = await this.lockGraphOf(em, id, actorId);

      apply(item, workstream);
      workstream.touch();
      em.remove(item);
      await em.flush();
    });
  }

  private async lockGraphOf(
    em: SqlEntityManager,
    id: string,
    actorId: string,
  ): Promise<{ workstream: Workstream; item: ChecklistItem }> {
    // Scoped like the step lookup in lockWorkstreamGraphOfStep: a non-member
    // must get the same "ChecklistItem not found" as a nonexistent id.
    const unlocked = await em.findOneOrFail(
      ChecklistItem,
      { id, step: { workstream: { project: memberProject(actorId) } } },
      { populate: ['step'] },
    );
    const { workstream, step } = await lockWorkstreamGraphOfStep(
      em,
      unlocked.step.id,
      actorId,
    );
    const item = step.getChecklistItems().find((sibling) => sibling.id === id);

    if (!item) {
      throw new NotFoundError(`Checklist item ${id} no longer exists`);
    }

    return { workstream, item };
  }
}
