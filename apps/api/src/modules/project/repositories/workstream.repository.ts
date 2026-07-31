import { LockMode, raw } from '@mikro-orm/core';
import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { lockProjectOrder } from '@/modules/project/repositories/lock-project-order.query';
import { countNotesByStep } from '@/modules/project/repositories/note-count.query';

import type { Group } from '@/database/entities/group.entity';
import type { NoteCountsByStep } from '@/modules/project/repositories/note-count.query';

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

  async countNotesByStep(workstream: Workstream): Promise<NoteCountsByStep> {
    return countNotesByStep(
      this.em,
      workstream.getSteps().map((step) => step.id),
    );
  }

  async save(workstream: Workstream): Promise<void> {
    this.em.persist(workstream);
    await this.em.flush();
  }

  /** Inserts the workstream at the top of its group scope, shifting siblings down. */
  async insertAtTop(workstream: Workstream): Promise<void> {
    await this.em.transactional(async (em) => {
      await lockProjectOrder(em, workstream.project.id);
      await this.shiftScopeDown(
        em,
        workstream.project.id,
        workstream.group?.id ?? null,
      );

      workstream.position = 0;
      em.persist(workstream);
    });
  }

  /**
   * Moves the workstream to the top of the target group scope and closes the
   * gap it leaves behind. Both renumberings run while the row still sits in its
   * source scope, so neither statement touches the row being moved.
   */
  async saveMovedToGroup(
    workstream: Workstream,
    group: Group | null,
  ): Promise<void> {
    const projectId = workstream.project.id;
    const sourceGroupId = workstream.group?.id ?? null;
    const sourcePosition = workstream.position;

    await this.em.transactional(async (em) => {
      await lockProjectOrder(em, projectId);
      await this.shiftScopeDown(em, projectId, group?.id ?? null);
      await em.nativeUpdate(
        Workstream,
        {
          project: projectId,
          group: sourceGroupId,
          position: { $gt: sourcePosition },
        },
        { position: raw('position - 1') },
      );

      workstream.group = group;
      workstream.position = 0;
      em.persist(workstream);
    });
  }

  private async shiftScopeDown(
    em: SqlEntityManager,
    projectId: string,
    groupId: string | null,
  ): Promise<void> {
    await em.nativeUpdate(
      Workstream,
      { project: projectId, group: groupId },
      { position: raw('position + 1') },
    );
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
