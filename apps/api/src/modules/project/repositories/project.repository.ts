import { EntityRepository, LockMode, NotFoundError } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { lockVisibleProject } from '@/modules/project/repositories/lock-governance.query';
import { projectVisibleTo } from '@/modules/project/repositories/membership.query';

import type { User } from '@/database/entities/user.entity';

/** Read on the locked project row, so the decision can't act on stale authority. */
export interface TransferOwnershipContext {
  ownerId: string;
  /** Populated with its user; null when the id isn't a member row of this project. */
  targetMember: ProjectMember | null;
}

export interface RestoreContext {
  ownerId: string;
  isDeleted: boolean;
  liveOwnedCount: number;
}

@Injectable()
export class ProjectRepository extends EntityRepository<Project> {
  constructor(em: SqlEntityManager) {
    super(em, Project);
  }

  /**
   * A soft-deleted project is invisible to its members; only its owner keeps
   * seeing it, so it can be restored.
   */
  async findAllForUser(currentUserId: string): Promise<Project[]> {
    return this.find(
      {
        $or: [
          { deletedAt: null, members: { user: currentUserId } },
          { deletedAt: { $ne: null }, owner: currentUserId },
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
  async findOneForUser(id: string, currentUserId: string): Promise<Project> {
    return this.findOneOrFail({ id, ...projectVisibleTo(currentUserId) });
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

  /**
   * A joined member of the project, or null — pending invites and unknown
   * ids are indistinguishable, so user-table existence never leaks.
   */
  async findJoinedMember(
    projectId: string,
    userId: string,
  ): Promise<User | null> {
    const member = await this.em.findOne(
      ProjectMember,
      { project: projectId, user: userId },
      { populate: ['user'] },
    );

    return member?.user ?? null;
  }

  async save(project: Project): Promise<void> {
    this.em.persist(project);
    await this.em.flush();
  }

  /**
   * Governance mutations lock the project row and hand `decide` state read
   * under that lock — a concurrent transfer or deletion cannot leave the
   * decision acting on stale authority. `decide` throws to reject, rolling
   * the transaction back; it returns the new owner.
   */
  async transferOwnership(
    projectId: string,
    currentUserId: string,
    memberId: string,
    decide: (context: TransferOwnershipContext) => User,
  ): Promise<Project> {
    return this.em.transactional(async (em) => {
      const project = await lockVisibleProject(em, projectId, currentUserId);
      const targetMember = await em.findOne(
        ProjectMember,
        { id: memberId, project },
        { populate: ['user'] },
      );

      project.owner = decide({ ownerId: project.owner.id, targetMember });

      return project;
    });
  }

  async softDelete(
    projectId: string,
    currentUserId: string,
    decide: (context: { ownerId: string }) => void,
  ): Promise<void> {
    await this.em.transactional(async (em) => {
      const project = await lockVisibleProject(em, projectId, currentUserId);

      decide({ ownerId: project.owner.id });

      project.deletedAt = new Date();
    });
  }

  /**
   * The single write that may target a deleted project. Resolves through
   * visibility OR ownership (any `deletedAt`), so the owner reaches their
   * trash while everyone else still gets an indistinguishable 404.
   */
  async restoreOwned(
    projectId: string,
    currentUserId: string,
    decide: (context: RestoreContext) => void,
  ): Promise<Project> {
    return this.em.transactional(async (em) => {
      const reachable = await em.count(Project, {
        id: projectId,
        $or: [projectVisibleTo(currentUserId), { owner: currentUserId }],
      });
      if (!reachable) {
        throw new NotFoundError(`Project ${projectId} not found`);
      }

      const project = await em.findOneOrFail(
        Project,
        { id: projectId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      // Best-effort cap count (no owner-wide lock), same stance as createOwned.
      const liveOwnedCount = await em.count(Project, {
        owner: project.owner.id,
        deletedAt: null,
      });

      decide({
        ownerId: project.owner.id,
        isDeleted: Boolean(project.deletedAt),
        liveOwnedCount,
      });

      project.deletedAt = null;

      return project;
    });
  }
}
