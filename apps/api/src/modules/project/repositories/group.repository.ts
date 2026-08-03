import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { lockProjectOrder } from '@/modules/project/repositories/lock-project-order.query';

import type { Project } from '@/database/entities/project.entity';

@Injectable()
export class GroupRepository extends EntityRepository<Group> {
  constructor(em: SqlEntityManager) {
    super(em, Group);
  }

  async findAllByProject(project: Project): Promise<Group[]> {
    return this.find({ project }, { orderBy: { position: 'asc' } });
  }

  async findOneInProject(
    groupId: string,
    projectId: string,
  ): Promise<Group | null> {
    return this.findOne({
      id: groupId,
      project: projectId,
    });
  }

  async save(group: Group): Promise<void> {
    this.em.persist(group);
    await this.em.flush();
  }

  /** Appends the group after the project's existing groups. */
  async insertAtEnd(group: Group): Promise<void> {
    await this.em.transactional(async (em) => {
      await lockProjectOrder(em, group.project.id);

      // Deletion leaves holes in the sequence, so a row count could collide
      // with a surviving position.
      const [last] = await em.find(
        Group,
        { project: group.project.id },
        { orderBy: { position: 'desc' }, limit: 1 },
      );
      group.position = last ? last.position + 1 : 0;
      em.persist(group);
    });
  }

  /**
   * Renumbers the project's groups to the order `order` returns, which receives
   * them in their current order. Positions are rewritten contiguously from 0 in
   * one transaction; the unique constraint is deferred, so the rows may collide
   * until it commits.
   */
  async reorder(
    projectId: string,
    order: (groups: Group[]) => Group[],
  ): Promise<Group[]> {
    return this.em.transactional(async (em) => {
      await lockProjectOrder(em, projectId);
      const groups = await em.find(
        Group,
        { project: projectId },
        { orderBy: { position: 'asc' } },
      );

      const ordered = order(groups);
      for (const [index, group] of ordered.entries()) {
        group.position = index;
      }
      await em.flush();

      return ordered;
    });
  }

  /** Ungroups the group's workstreams — the FK is ON DELETE SET NULL. */
  async remove(group: Group): Promise<void> {
    this.em.remove(group);
    await this.em.flush();
  }
}
