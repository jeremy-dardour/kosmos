import { LockMode } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { HttpStatus, Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

@Injectable()
export class ChecklistItemRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async setDoneLocked(id: string, isDone: boolean): Promise<ChecklistItem> {
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

      if (item.step.outcome != null) {
        throw new ProblemDetailsException(
          HttpStatus.CONFLICT,
          'step-frozen',
          'Past checklist items cannot be changed',
        );
      }

      item.done = isDone;
      workstream.updatedAt = new Date(
        Math.max(Date.now(), workstream.updatedAt.getTime() + 1),
      );
      await em.flush();

      return item;
    });
  }
}
