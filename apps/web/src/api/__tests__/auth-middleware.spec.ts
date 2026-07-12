import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from '@/api/middlewares/auth-middleware';

import type { AuthProvider } from '@/auth/auth-provider.interface';

describe('createAuthMiddleware', () => {
  let mockAuthProvider: AuthProvider;
  let getAuth: ReturnType<typeof vi.fn<() => AuthProvider | null>>;

  beforeEach(() => {
    mockAuthProvider = {
      getAccessToken: vi.fn().mockResolvedValue('test-token-123'),
      logout: vi.fn(),
      initialize: vi.fn(),
      login: vi.fn(),
      isAuthenticated: vi.fn().mockReturnValue(true),
      getAuthenticatedUser: vi.fn().mockReturnValue({
        username: 'test@example.com',
        name: 'Test User',
      }),
    };

    getAuth = vi
      .fn<() => AuthProvider | null>()
      .mockReturnValue(mockAuthProvider);
  });

  describe('onRequest', () => {
    it('should add Authorization header when token is available', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const request = new Request('http://localhost/api/test');

      await middleware.onRequest({ request });

      expect(mockAuthProvider.getAccessToken).toHaveBeenCalled();
      expect(request.headers.get('Authorization')).toBe(
        'Bearer test-token-123',
      );
    });

    it('should not add Authorization header when auth provider is null', async () => {
      getAuth.mockReturnValueOnce(null);
      const middleware = createAuthMiddleware(getAuth);
      const request = new Request('http://localhost/api/test');

      await middleware.onRequest({ request });

      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('should not add Authorization header when getAccessToken returns empty string', async () => {
      mockAuthProvider.getAccessToken = vi.fn().mockResolvedValueOnce('');
      const middleware = createAuthMiddleware(getAuth);
      const request = new Request('http://localhost/api/test');

      await middleware.onRequest({ request });

      expect(request.headers.get('Authorization')).toBeNull();
    });

    it('should add header to request with existing headers', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const request = new Request('http://localhost/api/test', {
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value',
        },
      });

      await middleware.onRequest({ request });

      expect(request.headers.get('Authorization')).toBe(
        'Bearer test-token-123',
      );
      expect(request.headers.get('Content-Type')).toBe('application/json');
      expect(request.headers.get('X-Custom-Header')).toBe('custom-value');
    });
  });

  describe('onResponse', () => {
    it('should call logout on 401 response', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 401 });

      await middleware.onResponse({ response });

      expect(mockAuthProvider.logout).toHaveBeenCalled();
    });

    it('should not call logout on 200 response', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 200 });

      await middleware.onResponse({ response });

      expect(mockAuthProvider.logout).not.toHaveBeenCalled();
    });

    it('should not call logout on 400 response', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 400 });

      await middleware.onResponse({ response });

      expect(mockAuthProvider.logout).not.toHaveBeenCalled();
    });
  });
});
