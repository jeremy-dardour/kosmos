import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';

import type { Project } from '@/database/entities/project.entity';

@Injectable()
export class GroupRepository extends EntityRepository<Group> {
  constructor(em: SqlEntityManager) {
    super(em, Group);
  }

  async findAllByProject(project: Project): Promise<Group[]> {
    return this.find({ project }, { orderBy: { name: 'asc' } });
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

  /** Ungroups the group's workstreams — the FK is ON DELETE SET NULL. */
  async remove(group: Group): Promise<void> {
    this.em.remove(group);
    await this.em.flush();
  }
}
