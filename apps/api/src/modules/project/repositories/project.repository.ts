import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Project } from '@/database/entities/project.entity';

@Injectable()
export class ProjectRepository extends EntityRepository<Project> {
  constructor(em: SqlEntityManager) {
    super(em, Project);
  }

  async findAllOrdered(): Promise<Project[]> {
    return this.findAll({
      orderBy: { createdAt: 'asc' },
    });
  }

  async save(project: Project): Promise<void> {
    this.em.persist(project);
    await this.em.flush();
  }
}
