import { createParamDecorator } from '@nestjs/common';

import type { ActorRequest } from '@/app/auth/types/token.types';
import type { User } from '@/database/entities/user.entity';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Exported for the decorator's unit test — `createParamDecorator` hides the
 * factory it wraps.
 */
export function readStashedActor(context: ExecutionContext): User {
  const request = context.switchToHttp().getRequest<ActorRequest>();

  if (!request.actor) {
    throw new Error(
      '@Actor() requires ActorInterceptor bound on the controller',
    );
  }

  return request.actor;
}

/**
 * The persisted actor stashed by `ActorInterceptor`. Fails closed: on a
 * controller without the interceptor bound this is a 500, never an unscoped
 * pass.
 */
export const Actor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    readStashedActor(context),
);
