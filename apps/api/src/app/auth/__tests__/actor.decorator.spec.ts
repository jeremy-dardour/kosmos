import { describe, expect, it } from 'vitest';

import { readStashedActor } from '@/app/auth/decorators/actor.decorator';
import { User } from '@/database/entities/user.entity';

import type { ActorRequest } from '@/app/auth/types/token.types';
import type { ExecutionContext } from '@nestjs/common';

function buildContext(request: Partial<ActorRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('readStashedActor', () => {
  it('returns the actor stashed by the interceptor', () => {
    const actor = new User();

    expect(readStashedActor(buildContext({ actor }))).toBe(actor);
  });

  it('fails closed when the interceptor is not bound', () => {
    expect(() => readStashedActor(buildContext({}))).toThrow(
      'ActorInterceptor',
    );
  });
});
