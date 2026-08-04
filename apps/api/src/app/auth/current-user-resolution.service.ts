import { Injectable } from '@nestjs/common';

import { AuthenticationException } from '@/app/auth/exceptions/authentication.exception';
import { UserRepository } from '@/database/repositories/user.repository';

import type { AuthenticatedUser } from '@/app/auth/types/token.types';
import type { User } from '@/database/entities/user.entity';

/**
 * Read-only counterpart of {@link AuthUserProvisionerService}: the guard never
 * writes, and provisioning happens once at `/users/me`, so a request whose
 * identity has no row is acting on a stale session.
 */
@Injectable()
export class CurrentUserResolutionService {
  constructor(private readonly userRepository: UserRepository) {}

  async resolve(authenticatedUser: AuthenticatedUser): Promise<User> {
    const email = authenticatedUser.email.toLowerCase();
    const user = await this.userRepository.findOne({ email });

    if (!user) {
      throw new AuthenticationException('No account for the current session');
    }

    return user;
  }
}
