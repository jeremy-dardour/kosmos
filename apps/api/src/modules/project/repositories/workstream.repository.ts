import { raw } from '@mikro-orm/core';
import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Workstream } from '@/database/entities/workstream.entity';
import { lockProjectOrder } from '@/modules/project/repositories/lock-project-order.query';
import {
  lockWorkstreamGraph,
  WORKSTREAM_GRAPH,
} from '@/modules/project/repositories/lock-workstream-graph.query';
import { countNotesByStep } from '@/modules/project/repositories/note-count.query';

import type { NoteCountsByStep } from '@/modules/project/types/note-counts.type';

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
      await this.openGapAtTop(
        em,
        workstream.project.id,
        workstream.group?.id ?? null,
      );

      workstream.position = 0;
      em.persist(workstream);
    });
  }

  /**
   * Moves the workstream — its new group already assigned by the caller — to
   * the top of that scope, and closes the gap it leaves in `sourceGroupId`.
   * Both renumberings hit the database while the row still sits in its source
   * scope, so neither statement touches the row being moved.
   */
  async moveToGroup(
    workstream: Workstream,
    sourceGroupId: string | null,
  ): Promise<void> {
    const projectId = workstream.project.id;
    const sourcePosition = workstream.position;

    await this.em.transactional(async (em) => {
      await lockProjectOrder(em, projectId);
      await this.openGapAtTop(em, projectId, workstream.group?.id ?? null);
      await this.closeGapAfter(em, projectId, sourceGroupId, sourcePosition);

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

  /** Frees position 0 of a scope by shifting every row toward higher positions. */
  private async openGapAtTop(
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

  /** Closes the hole a row that left `position` opened in its scope. */
  private async closeGapAfter(
    em: SqlEntityManager,
    projectId: string,
    groupId: string | null,
    position: number,
  ): Promise<void> {
    await em.nativeUpdate(
      Workstream,
      { project: projectId, group: groupId, position: { $gt: position } },
      { position: raw('position - 1') },
    );
  }

  async updateLockedDetails(
    id: string,
    apply: (workstream: Workstream) => void,
  ): Promise<Workstream> {
    return this.em.transactional(async (em) => {
      const workstream = await lockWorkstreamGraph(em, id);

      apply(workstream);
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
