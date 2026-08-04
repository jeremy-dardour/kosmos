import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { CurrentUserResolutionService } from '@/app/auth/current-user-resolution.service';
import { SKIP_USER_RESOLUTION_KEY } from '@/app/auth/decorators/skip-user-resolution.decorator';

import type { CurrentUserRequest } from '@/app/auth/types/token.types';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Globally bound: resolves the persisted current user once per request and
 * stashes it on the request for the `@CurrentUser()` param decorator. Skips
 * routes marked `@SkipUserResolution()` and requests without an authenticated
 * principal (`@Public()` routes), where there is nothing to resolve.
 */
@Injectable()
export class CurrentUserInterceptor implements NestInterceptor {
  constructor(
    private readonly currentUserResolution: CurrentUserResolutionService,
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const shouldSkip = this.reflector.getAllAndOverride<boolean>(
      SKIP_USER_RESOLUTION_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<CurrentUserRequest>();

    if (!shouldSkip && request.user) {
      request.currentUser = await this.currentUserResolution.resolve(
        request.user,
      );
    }

    return next.handle();
  }
}
