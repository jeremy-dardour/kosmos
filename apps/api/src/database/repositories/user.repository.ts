import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';

export interface UserProfile {
  email: string;
  name: string;
  avatarUrl: string | null;
}

@Injectable()
export class UserRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findOne(id: string): Promise<User> {
    return this.em.findOneOrFail(User, { id });
  }

  async upsertProfile(profile: UserProfile): Promise<User> {
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
