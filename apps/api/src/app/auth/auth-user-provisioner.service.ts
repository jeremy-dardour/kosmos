import { Injectable } from '@nestjs/common';

import { UserRepository } from '@/database/repositories/user.repository';

import type { AuthenticatedUser } from '@/app/auth/types/token.types';

@Injectable()
export class AuthUserProvisionerService {
  constructor(private readonly userRepository: UserRepository) {}

  async provision(
    authenticatedUser: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const email = authenticatedUser.email.toLowerCase();
    const user = await this.userRepository.upsertProfile({
      email,
      name: authenticatedUser.name ?? email,
      avatarUrl: authenticatedUser.avatarUrl ?? null,
    });

    return {
      ...authenticatedUser,
      id: user.id,
      email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}
