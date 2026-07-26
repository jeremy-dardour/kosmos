import { describe, expect, it, beforeEach } from 'vitest';

import { FakeAuthProvider } from '@/auth/fake-auth-provider';

describe('fakeAuthProvider', () => {
  let provider: FakeAuthProvider;

  beforeEach(() => {
    provider = new FakeAuthProvider();
  });

  it('should start authenticated so the app is usable without a real login', () => {
    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: {
        id: '00000000-0000-4000-8000-000000000001',
        email: 'dev.user@example.com',
        name: 'DevUser',
      },
    });
  });

  it('should go anonymous on signOut and back on signIn', async () => {
    provider.signOut();
    expect(provider.getState()).toEqual({ status: 'anonymous' });

    await provider.signIn();

    expect(provider.getState().status).toBe('authenticated');
  });

  it('should notify subscribers on every change', () => {
    let calls = 0;
    const unsubscribe = provider.subscribe(() => {
      calls += 1;
    });

    provider.signOut();
    unsubscribe();
    provider.signOut();

    expect(calls).toBe(1);
  });

  it('should reject getAccessToken when not authenticated', async () => {
    provider.signOut();

    await expect(provider.getAccessToken()).rejects.toThrow(
      '[FakeAuthProvider] User is not authenticated',
    );
  });

  it('should return a JWT-shaped token when authenticated', async () => {
    const token = await provider.getAccessToken();

    expect(token.split('.')).toHaveLength(3);
  });
});
