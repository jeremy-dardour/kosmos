import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Project } from '@/database/entities/project.entity';

@Injectable()
export class ProjectRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findAll(): Promise<Project[]> {
    return this.em.findAll(Project, {
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string): Promise<Project> {
    return this.em.findOneOrFail(Project, { id });
  }

  async save(project: Project): Promise<void> {
    this.em.persist(project);
    await this.em.flush();
  }
}
