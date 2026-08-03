import { NotFoundError } from '@mikro-orm/core';
import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { lockWorkstreamGraphOfStep } from '@/modules/project/repositories/lock-workstream-graph.query';

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

  /** `build` returns the new item, appended to the locked step. */
  async createLocked(
    stepId: string,
    build: (step: Step, workstream: Workstream) => ChecklistItem,
  ): Promise<ChecklistItem> {
    return this.em.transactional(async (em) => {
      const { workstream, step } = await lockWorkstreamGraphOfStep(em, stepId);

      const item = build(step, workstream);
      em.persist(item);
      await em.flush();

      return item;
    });
  }

  async updateLocked(id: string, apply: ApplyToItem): Promise<ChecklistItem> {
    return this.em.transactional(async (em) => {
      const { workstream, item } = await this.lockGraphOf(em, id);

      apply(item, workstream);
      await em.flush();

      return item;
    });
  }

  /** Same lock as `updateLocked`; `apply` renumbers the siblings left behind. */
  async removeLocked(id: string, apply: ApplyToItem): Promise<void> {
    await this.em.transactional(async (em) => {
      const { workstream, item } = await this.lockGraphOf(em, id);

      apply(item, workstream);
      em.remove(item);
      await em.flush();
    });
  }

  private async lockGraphOf(
    em: SqlEntityManager,
    id: string,
  ): Promise<{ workstream: Workstream; item: ChecklistItem }> {
    const unlocked = await em.findOneOrFail(
      ChecklistItem,
      { id },
      { populate: ['step'] },
    );
    const { workstream, step } = await lockWorkstreamGraphOfStep(
      em,
      unlocked.step.id,
    );
    const item = step.getChecklistItems().find((sibling) => sibling.id === id);

    if (!item) {
      throw new NotFoundError(`Checklist item ${id} no longer exists`);
    }

    return { workstream, item };
  }
}
