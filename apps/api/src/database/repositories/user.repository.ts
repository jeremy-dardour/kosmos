import { SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';

@Injectable()
export class UserRepository {
  constructor(private readonly em: SqlEntityManager) {}

  async findOne(id: string): Promise<User> {
    return this.em.findOneOrFail(User, { id });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.em.findOne(User, { email });
  }

  async save(user: User): Promise<void> {
    this.em.persist(user);
    await this.em.flush();
  }
}
