import { createParamDecorator } from '@nestjs/common';

import type { CurrentUserRequest } from '@/app/auth/types/token.types';
import type { User } from '@/database/entities/user.entity';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The persisted current user stashed by the globally bound
 * `CurrentUserInterceptor`. Fails closed: on a route opted out via
 * `@SkipUserResolution()` (or a public route) this is a 500, never an
 * unscoped pass.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    const request = context.switchToHttp().getRequest<CurrentUserRequest>();

    if (!request.currentUser) {
      throw new Error(
        '@CurrentUser() requires user resolution — the route is public or marked @SkipUserResolution()',
      );
    }

    return request.currentUser;
  },
);
