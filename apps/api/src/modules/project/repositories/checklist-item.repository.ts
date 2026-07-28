import { LockMode } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Workstream } from '@/database/entities/workstream.entity';

@Injectable()
export class ChecklistItemRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async updateLocked(
    id: string,
    apply: (item: ChecklistItem, workstream: Workstream) => void,
  ): Promise<ChecklistItem> {
    return this.em.transactional(async (em) => {
      const initialItem = await em.findOneOrFail(
        ChecklistItem,
        { id },
        { populate: ['step.workstream'] },
      );
      const workstreamId = initialItem.step.workstream.id;
      const workstream = await em.findOneOrFail(
        Workstream,
        { id: workstreamId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      const item = await em.findOneOrFail(
        ChecklistItem,
        { id, step: { workstream: workstreamId } },
        { populate: ['step'], refresh: true },
      );

      apply(item, workstream);
      await em.flush();

      return item;
    });
  }
}
