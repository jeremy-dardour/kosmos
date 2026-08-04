import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';

import { CurrentUser } from '@/app/auth/decorators/current-user.decorator';
import { User } from '@/database/entities/user.entity';

import type { CurrentUserRequest } from '@/app/auth/types/token.types';
import type { ExecutionContext } from '@nestjs/common';

// `createParamDecorator` hides its factory; Nest stashes it in the probe
// class's route-args metadata, from which the test extracts and calls it.
class Probe {
  handle(@CurrentUser() _user: User): void {
    // Only the decorator's route-args metadata matters.
  }
}

function decoratorFactory(): (
  data: unknown,
  context: ExecutionContext,
) => User {
  // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- reflect-metadata is loaded by Nest
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handle',
  ) as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => User }
  >;

  return Object.values(metadata)[0]!.factory;
}

function buildContext(request: Partial<CurrentUserRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;
}

describe('@CurrentUser()', () => {
  it('returns the current user stashed by the interceptor', () => {
    const currentUser = new User();

    expect(decoratorFactory()(undefined, buildContext({ currentUser }))).toBe(
      currentUser,
    );
  });

  it('fails closed when resolution was skipped', () => {
    expect(() => decoratorFactory()(undefined, buildContext({}))).toThrow(
      '@CurrentUser() requires user resolution',
    );
  });
});
