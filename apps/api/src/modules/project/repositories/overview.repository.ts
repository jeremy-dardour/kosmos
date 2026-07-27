import { IsolationLevel } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';

@Injectable()
export class OverviewRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async load(projectId: string): Promise<{
    project: Project;
    groups: Group[];
    workstreams: Workstream[];
    users: User[];
  }> {
    return this.em.transactional(
      async (em) => {
        const project = await em.findOneOrFail(Project, { id: projectId });
        const groups = await em.find(
          Group,
          { project: projectId },
          { orderBy: { name: 'asc' } },
        );
        const workstreams = await em.find(
          Workstream,
          { project: projectId },
          {
            populate: [
              'owner',
              'group',
              'currentStep',
              'steps',
              'steps.owner',
              'steps.checklistItems',
            ],
            orderBy: { name: 'asc' },
          },
        );
        const users = await em.find(User, {}, { orderBy: { name: 'asc' } });

        return { project, groups, workstreams, users };
      },
      {
        isolationLevel: IsolationLevel.REPEATABLE_READ,
        readOnly: true,
      },
    );
  }
}
