import { describe, expect, it, vi } from 'vitest';

import { CurrentUserInterceptor } from '@/app/auth/current-user.interceptor';
import { User } from '@/database/entities/user.entity';

import type { CurrentUserRequest } from '@/app/auth/types/token.types';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

function buildContext(request: Partial<CurrentUserRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: vi.fn(),
    getClass: vi.fn(),
  } as never;
}

function buildReflector(shouldSkip: boolean): Reflector {
  return { getAllAndOverride: () => shouldSkip } as never;
}

describe('currentUserInterceptor', () => {
  it('stashes the resolved current user on the request before the handler runs', async () => {
    const currentUser = new User();
    const resolve = vi.fn(() => Promise.resolve(currentUser));
    const interceptor = new CurrentUserInterceptor(
      { resolve } as never,
      buildReflector(false),
    );
    const request: Partial<CurrentUserRequest> = {
      user: { email: 'someone@example.com' },
    };
    const next: CallHandler = { handle: vi.fn() };

    await interceptor.intercept(buildContext(request), next);

    expect(request.currentUser).toBe(currentUser);
    expect(resolve).toHaveBeenCalledWith(request.user);
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('skips resolution on routes marked @SkipUserResolution()', async () => {
    const resolve = vi.fn();
    const interceptor = new CurrentUserInterceptor(
      { resolve } as never,
      buildReflector(true),
    );
    const request: Partial<CurrentUserRequest> = {
      user: { email: 'someone@example.com' },
    };
    const next: CallHandler = { handle: vi.fn() };

    await interceptor.intercept(buildContext(request), next);

    expect(request.currentUser).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('skips resolution when there is no authenticated principal', async () => {
    const resolve = vi.fn();
    const interceptor = new CurrentUserInterceptor(
      { resolve } as never,
      buildReflector(false),
    );
    const request: Partial<CurrentUserRequest> = {};
    const next: CallHandler = { handle: vi.fn() };

    await interceptor.intercept(buildContext(request), next);

    expect(request.currentUser).toBeUndefined();
    expect(resolve).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalledOnce();
  });

  it('propagates the resolution failure without invoking the handler', async () => {
    const interceptor = new CurrentUserInterceptor(
      {
        resolve: vi.fn(() => Promise.reject(new Error('stale session'))),
      } as never,
      buildReflector(false),
    );
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
