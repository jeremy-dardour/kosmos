import { raw } from '@mikro-orm/core';
import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ChecklistItem } from '@/database/entities/checklist-item.entity';
import { Step } from '@/database/entities/step.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { lockProjectOrder } from '@/modules/project/repositories/lock-project-order.query';
import {
  lockWorkstreamGraph,
  WORKSTREAM_GRAPH,
} from '@/modules/project/repositories/lock-workstream-graph.query';
import { countNotesByStep } from '@/modules/project/repositories/note-count.query';

import type { Group } from '@/database/entities/group.entity';
import type { NoteCountsByStep } from '@/modules/project/repositories/note-count.query';

export interface LockedWorkstreamChanges {
  removedSteps?: Step[];
  removedChecklistItems?: ChecklistItem[];
}

@Injectable()
export class WorkstreamRepository extends EntityRepository<Workstream> {
  constructor(em: SqlEntityManager) {
    super(em, Workstream);
  }

  async findDetails(id: string): Promise<Workstream> {
    return this.findOneOrFail(
      { id },
      { populate: [...WORKSTREAM_GRAPH], refresh: true },
    );
  }

  async countNotesByStep(
    workstreams: readonly Workstream[],
  ): Promise<NoteCountsByStep> {
    return countNotesByStep(
      this.em,
      workstreams.flatMap((workstream) =>
        workstream.getSteps().map((step) => step.id),
      ),
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

  /**
   * Renumbers one group scope to the order `order` returns, which receives the
   * whole scope in its current order. Positions are rewritten contiguously from
   * 0 in one transaction; the unique constraint is deferred, so the rows may
   * collide until it commits.
   */
  async reorderScope(
    projectId: string,
    groupId: string | null,
    order: (scope: Workstream[]) => Workstream[],
  ): Promise<Workstream[]> {
    return this.em.transactional(async (em) => {
      await lockProjectOrder(em, projectId);
      const scope = await em.find(
        Workstream,
        { project: projectId, group: groupId },
        {
          populate: [...WORKSTREAM_GRAPH],
          orderBy: { position: 'asc' },
        },
      );

      const ordered = order(scope);
      for (const [index, workstream] of ordered.entries()) {
        workstream.position = index;
      }
      await em.flush();

      return ordered;
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
      const workstream = await lockWorkstreamGraph(em, id);

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
