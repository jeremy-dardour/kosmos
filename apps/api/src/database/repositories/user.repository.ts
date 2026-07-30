import { EntityRepository } from '@mikro-orm/core';
import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';

@Injectable()
export class UserRepository extends EntityRepository<User> {
  constructor(em: SqlEntityManager) {
    super(em, User);
  }

  async upsertProfile(profile: {
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<User> {
    return this.em.upsert(
      User,
      { ...profile, updatedAt: new Date() },
      {
        onConflictFields: ['email'],
        onConflictAction: 'merge',
        onConflictMergeFields: ['name', 'avatarUrl', 'updatedAt'],
      },
    );
  }
}
