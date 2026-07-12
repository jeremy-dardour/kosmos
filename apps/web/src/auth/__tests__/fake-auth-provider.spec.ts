import { describe, expect, it, beforeEach } from 'vitest';

import { FakeAuthProvider } from '@/auth/fake-auth-provider';

describe('fakeAuthProvider', () => {
  let provider: FakeAuthProvider;

  beforeEach(() => {
    provider = new FakeAuthProvider();
  });

  describe('initialize', () => {
    it('should set authenticated to true', () => {
      provider.initialize();

      expect(provider.isAuthenticated()).toBe(true);
    });
  });

  describe('login', () => {
    it('should set authenticated to true', () => {
      provider.login();

      expect(provider.isAuthenticated()).toBe(true);
    });
  });

  describe('logout', () => {
    it('should set authenticated to false', () => {
      provider.initialize();
      expect(provider.isAuthenticated()).toBe(true);

      provider.logout();

      expect(provider.isAuthenticated()).toBe(false);
    });
  });

  describe('getAuthenticatedUser', () => {
    it('should return null when not authenticated', () => {
      expect(provider.getAuthenticatedUser()).toBeNull();
    });

    it('should return user info when authenticated', () => {
      provider.initialize();

      const user = provider.getAuthenticatedUser();

      expect(user).toEqual({
        username: 'dev.user@example.com',
        name: 'DevUser',
      });
    });
  });

  describe('getAccessToken', () => {
    it('should throw error when not authenticated', async () => {
      await expect(provider.getAccessToken()).rejects.toThrow(
        '[FakeAuthProvider] User is not authenticated',
      );
    });

    it('should return a valid JWT token when authenticated', async () => {
      provider.initialize();

      const token = await provider.getAccessToken();

      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });
  });
});
