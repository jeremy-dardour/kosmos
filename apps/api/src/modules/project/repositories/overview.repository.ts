import { IsolationLevel } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Group } from '@/database/entities/group.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';
import { Workstream } from '@/database/entities/workstream.entity';
import { WORKSTREAM_GRAPH } from '@/modules/project/repositories/lock-workstream-graph.query';
import { countNotesByStep } from '@/modules/project/repositories/note-count.query';

import type { NoteCountsByStep } from '@/modules/project/types/note-counts.type';

@Injectable()
export class OverviewRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async load(projectId: string): Promise<{
    project: Project;
    groups: Group[];
    workstreams: Workstream[];
    users: User[];
    noteCounts: NoteCountsByStep;
  }> {
    return this.em.transactional(
      async (em) => {
        const project = await em.findOneOrFail(Project, { id: projectId });
        const groups = await em.find(
          Group,
          { project: projectId },
          { orderBy: { position: 'asc' } },
        );
        const workstreams = await em.find(
          Workstream,
          { project: projectId },
          {
            populate: [...WORKSTREAM_GRAPH],
            // Positions only order a group scope, so name keeps the flat list
            // deterministic across scopes.
            orderBy: { position: 'asc', name: 'asc' },
          },
        );
        const users = await em.find(User, {}, { orderBy: { name: 'asc' } });
        const noteCounts = await countNotesByStep(
          em,
          workstreams.flatMap((workstream) =>
            workstream.getSteps().map((step) => step.id),
          ),
        );

        return { project, groups, workstreams, users, noteCounts };
      },
      {
        isolationLevel: IsolationLevel.REPEATABLE_READ,
        readOnly: true,
      },
    );
  }
}
