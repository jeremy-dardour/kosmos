import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    fakeAuth: true,
    dev: true,
    apiUrl: 'http://localhost:3000',
  },
}));

vi.mock('@/auth/fake-auth-provider', () => ({
  FakeAuthProvider: vi.fn(function () {
    return {
      initialize: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: vi.fn(),
      getAuthenticatedUser: vi.fn(),
      getAccessToken: vi.fn().mockResolvedValue('fake-token'),
    };
  }),
}));

import { createAuthProvider } from '@/auth/create-auth-provider';
import { FakeAuthProvider } from '@/auth/fake-auth-provider';

describe('createAuthProvider', () => {
  it('should create FakeAuthProvider and initialize it', () => {
    const provider = createAuthProvider();

    expect(FakeAuthProvider).toHaveBeenCalledOnce();
    expect(provider.initialize).toHaveBeenCalledOnce();
    expect(provider.login).toBeDefined();
  });
});
