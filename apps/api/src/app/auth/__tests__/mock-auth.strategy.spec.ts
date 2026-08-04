import { describe, expect, it } from 'vitest';

import { MockAuthStrategy } from '@/app/auth/strategies/mock-auth.strategy';

import type { AuthenticatedRequest } from '@/app/auth/types/token.types';

function requestWith(authorization?: string): AuthenticatedRequest {
  return {
    headers: authorization === undefined ? {} : { authorization },
  } as AuthenticatedRequest;
}

describe('mockAuthStrategy', () => {
  const strategy = new MockAuthStrategy();

  it('authenticates as the partner identity for the partner token', async () => {
    const user = await strategy.authenticate(
      requestWith('Bearer mock-partner'),
    );

    expect(user).toEqual({
      email: 'mock-partner@example.com',
      name: 'MockPartner',
    });
  });

  it.each([
    ['another token', 'Bearer whatever'],
    ['no authorization header', undefined],
  ])(
    'authenticates as the default identity with %s',
    async (_label, header) => {
      const user = await strategy.authenticate(requestWith(header));

      expect(user).toEqual({ email: 'mock@example.com', name: 'MockUser' });
    },
  );
});
