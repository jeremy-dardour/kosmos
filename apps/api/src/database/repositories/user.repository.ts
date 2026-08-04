import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { ProjectMember } from '@/database/entities/project-member.entity';
import { User } from '@/database/entities/user.entity';

@Injectable()
export class UserRepository extends EntityRepository<User> {
  constructor(em: SqlEntityManager) {
    super(em, User);
  }

  /**
   * First login also claims the memberships invited by email — the one place
   * pending becomes joined, so it commits with the user row or not at all.
   * Email is normalized here, at the seam: the upsert conflict target and the
   * membership claim both silently miss on a mixed-case value.
   */
  async upsertProfile(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<User> {
    const email = profile.email.toLowerCase();

    return this.em.transactional(async (em) => {
      const user = await em.upsert(
        User,
        { ...profile, email, updatedAt: new Date() },
        {
          onConflictFields: ['email'],
          onConflictAction: 'merge',
          onConflictMergeFields: ['name', 'avatarUrl', 'updatedAt'],
        },
      );

      await em.nativeUpdate(
        ProjectMember,
        { email, user: null },
        { user: user.id, updatedAt: new Date() },
      );

      return user;
    });
  }
}
