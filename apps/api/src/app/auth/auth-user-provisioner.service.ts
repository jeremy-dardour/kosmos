import { Injectable } from '@nestjs/common';

import { User } from '@/database/entities/user.entity';
import { UserRepository } from '@/database/repositories/user.repository';

import type { AuthenticatedUser } from '@/app/auth/types/token.types';

@Injectable()
export class AuthUserProvisionerService {
  constructor(private readonly userRepository: UserRepository) {}

  async provision(
    authenticatedUser: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const email = authenticatedUser.email.toLowerCase();
    const user =
      (await this.userRepository.findOneByEmail(email)) ?? new User();

    user.email = email;
    user.name = authenticatedUser.name ?? email;
    user.avatarUrl = authenticatedUser.avatarUrl ?? null;

    await this.userRepository.save(user);

    return {
      ...authenticatedUser,
      id: user.id,
      email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}
