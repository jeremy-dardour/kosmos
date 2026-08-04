import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { memberProject } from '@/modules/project/repositories/membership.query';

import type { User } from '@/database/entities/user.entity';

@Injectable()
export class ProjectRepository extends EntityRepository<Project> {
  constructor(em: SqlEntityManager) {
    super(em, Project);
  }

  /**
   * A soft-deleted project is invisible to its members; only its owner keeps
   * seeing it, so it can be restored.
   */
  async findAllForActor(actorId: string): Promise<Project[]> {
    return this.find(
      {
        $or: [
          { deletedAt: null, members: { user: actorId } },
          { deletedAt: { $ne: null }, owner: actorId },
        ],
      },
      { orderBy: { createdAt: 'asc' } },
    );
  }

  /**
   * The single-project read/write root: members only, and a soft-deleted
   * project 404s even for its owner — content routes never see the trash
   * (only the list above and T-4's restore do).
   */
  async findOneForActor(id: string, actorId: string): Promise<Project> {
    return this.findOneOrFail({ id, ...memberProject(actorId) });
  }

  /**
   * Creates the project and the owner's member row together — membership alone
   * answers "who can access this project". `build` receives the owner's current
   * project count so the caller can reject the write inside the transaction.
   * The count is deliberately unlocked: the cap bounds accidents, and a race
   * around the boundary is cheaper than serializing every creation.
   */
  async createOwned(
    owner: User,
    build: (ownedCount: number) => Project,
  ): Promise<Project> {
    return this.em.transactional(async (em) => {
      const ownedCount = await em.count(Project, { owner, deletedAt: null });
      const project = build(ownedCount);

      em.persist(project);
      em.create(ProjectMember, { project, email: owner.email, user: owner });

      return project;
    });
  }

  async save(project: Project): Promise<void> {
    this.em.persist(project);
    await this.em.flush();
  }
}
