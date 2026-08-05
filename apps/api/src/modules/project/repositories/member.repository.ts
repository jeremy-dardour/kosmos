import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { Project } from '@/database/entities/project.entity';
import { User } from '@/database/entities/user.entity';
import { lockVisibleProject } from '@/modules/project/repositories/lock-governance.query';
import { projectVisibleTo } from '@/modules/project/repositories/membership.query';

/** Read on the locked project row, so the decision can't act on stale authority. */
export interface AddMemberContext {
  ownerId: string;
  existing: ProjectMember | null;
  memberCount: number;
}

export interface RemoveMemberContext {
  ownerId: string;
  member: ProjectMember;
}

@Injectable()
export class MemberRepository extends EntityRepository<ProjectMember> {
  constructor(em: SqlEntityManager) {
    super(em, ProjectMember);
  }

  async findProjectMembers(
    projectId: string,
    currentUserId: string,
  ): Promise<{ ownerId: string; members: ProjectMember[] }> {
    const project = await this.em.findOneOrFail(Project, {
      id: projectId,
      ...projectVisibleTo(currentUserId),
    });
    const members = await this.find(
      { project: projectId },
      { populate: ['user'], orderBy: { createdAt: 'asc' } },
    );

    return { ownerId: project.owner.id, members };
  }

  /**
   * Governance mutations lock the project row and hand `decide` state read
   * under that lock — a concurrent ownership transfer or membership change
   * cannot leave the decision acting on stale authority.
   *
   * @param decide The service's policy callback in the order-callback idiom
   * (see the manual-ordering standard): it runs under the lock and throws to
   * reject, rolling the transaction back.
   */
  async addMember(
    projectId: string,
    currentUserId: string,
    email: string,
    decide: (context: AddMemberContext) => void,
  ): Promise<ProjectMember> {
    return this.em.transactional(async (em) => {
      const project = await lockVisibleProject(em, projectId, currentUserId);

      const existing = await em.findOne(ProjectMember, { project, email });
      const memberCount = await em.count(ProjectMember, { project });
      decide({ ownerId: project.owner.id, existing, memberCount });

      // An existing account joins immediately; otherwise the row stays
      // pending until attach-on-login claims it.
      const user = await em.findOne(User, { email });

      return em.create(ProjectMember, { project, email, user });
    });
  }

  async removeMember(
    projectId: string,
    currentUserId: string,
    memberId: string,
    decide: (context: RemoveMemberContext) => void,
  ): Promise<void> {
    await this.em.transactional(async (em) => {
      const project = await lockVisibleProject(em, projectId, currentUserId);

      const member = await em.findOneOrFail(
        ProjectMember,
        { id: memberId, project },
        { populate: ['user'] },
      );
      decide({ ownerId: project.owner.id, member });

      // Removal deletes the row. Unsetting `user` instead would be silently
      // undone at the target's next login by the attach-on-login claim.
      em.remove(member);
    });
  }
}
