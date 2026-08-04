import { Injectable } from '@nestjs/common';

import { ActorResolutionService } from '@/app/auth/actor-resolution.service';

import type { ActorRequest } from '@/app/auth/types/token.types';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';

/**
 * Resolves the persisted actor once per request and stashes it on the request
 * for the `@Actor()` param decorator. Bound per controller class on every
 * controller whose routes are actor-scoped; the user controller stays unbound
 * because `/users/me` is what provisions the row this resolution requires.
 */
@Injectable()
export class ActorInterceptor implements NestInterceptor {
  constructor(private readonly actorResolution: ActorResolutionService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    request.actor = await this.actorResolution.resolve(request.user);

    return next.handle();
  }
}
