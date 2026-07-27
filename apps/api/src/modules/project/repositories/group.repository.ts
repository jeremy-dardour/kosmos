import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';

@Injectable()
export class GroupRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findAllByProject(project: Project): Promise<Group[]> {
    return this.em.find(Group, { project }, { orderBy: { name: 'asc' } });
  }

  async findOne(id: string): Promise<Group> {
    return this.em.findOneOrFail(Group, { id });
  }

  async findOneInProject(
    groupId: string,
    projectId: string,
  ): Promise<Group | null> {
    return this.em.findOne(Group, {
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
