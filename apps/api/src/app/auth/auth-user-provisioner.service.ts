import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';

import type { AuthenticatedUser } from '@/app/auth/types/token.types';

@Injectable()
export class AuthUserProvisionerService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: EntityRepository<User>,
  ) {}

  async provision(
    authenticatedUser: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const email = authenticatedUser.email.toLowerCase();
    const user =
      (await this.userRepository.findOne({ email })) ??
      this.userRepository.create({
        email,
        name: authenticatedUser.name ?? email,
        avatarUrl: authenticatedUser.avatarUrl ?? null,
      });

    this.userRepository.assign(user, {
      email,
      name: authenticatedUser.name ?? email,
      avatarUrl: authenticatedUser.avatarUrl ?? null,
    });

    await this.userRepository.getEntityManager().flush();

    return {
      ...authenticatedUser,
      id: user.id,
      email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}
