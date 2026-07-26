import { describe, expect, it } from 'vitest';

import { FakeAuthProvider } from '@/auth/fake-auth-provider';

// Thin coverage on purpose: the fake ships to production and web e2e depends on
// it, but it has no logic of its own beyond matching the real state machine.
describe('fakeAuthProvider', () => {
  it('should start authenticated so the app is usable without a real login', () => {
    expect(new FakeAuthProvider().getState()).toEqual({
      status: 'authenticated',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'dev.user@example.com',
        name: 'DevUser',
      },
    });
  });

  it('should go anonymous on signOut and back on signIn', async () => {
    const provider = new FakeAuthProvider();

    provider.signOut();
    expect(provider.getState()).toEqual({ status: 'anonymous' });

    await provider.signIn();

    expect(provider.getState().status).toBe('authenticated');
  });
});
