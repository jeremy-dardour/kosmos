import { describe, expect, it, vi } from 'vitest';

import { ActorInterceptor } from '@/app/auth/actor.interceptor';
import { User } from '@/database/entities/user.entity';

import type { ActorRequest } from '@/app/auth/types/token.types';
import type { CallHandler, ExecutionContext } from '@nestjs/common';

function buildContext(request: Partial<ActorRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('actorInterceptor', () => {
  it('stashes the resolved actor on the request before the handler runs', async () => {
    const actor = new User();
    const resolve = vi.fn(() => Promise.resolve(actor));
    const interceptor = new ActorInterceptor({ resolve } as never);
    const request: Partial<ActorRequest> = {
      user: { email: 'someone@example.com' },
    };
    const next: CallHandler = { handle: vi.fn() };

    await interceptor.intercept(buildContext(request), next);

    expect(request.actor).toBe(actor);
    expect(resolve).toHaveBeenCalledWith(request.user);
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('propagates the resolution failure without invoking the handler', async () => {
    const interceptor = new ActorInterceptor({
      resolve: vi.fn(() => Promise.reject(new Error('stale session'))),
    } as never);
    const next: CallHandler = { handle: vi.fn() };

    await expect(
      interceptor.intercept(
        buildContext({ user: { email: 'ghost@example.com' } }),
        next,
      ),
    ).rejects.toThrow('stale session');
    expect(next.handle).not.toHaveBeenCalled();
  });
});
