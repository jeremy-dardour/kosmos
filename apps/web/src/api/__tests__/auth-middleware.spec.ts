import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from '@/api/middlewares/auth-middleware';
import { createStubAuthProvider } from '@/testing/stub-auth';

import type { AuthProvider } from '@/auth/auth-provider.interface';

describe('createAuthMiddleware', () => {
  let mockAuthProvider: AuthProvider;
  let getAuth: ReturnType<typeof vi.fn<() => AuthProvider | null>>;

  beforeEach(() => {
    mockAuthProvider = createStubAuthProvider().provider;
    mockAuthProvider.getAccessToken = vi
      .fn()
      .mockResolvedValue('test-token-123');

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
    it('should sign out on 401 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 401 });

      middleware.onResponse({ response });

      expect(mockAuthProvider.signOut).toHaveBeenCalled();
    });

    it('should not sign out on 403 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 403 });

      middleware.onResponse({ response });

      expect(mockAuthProvider.signOut).not.toHaveBeenCalled();
    });

    it('should not sign out on 200 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 200 });

      middleware.onResponse({ response });

      expect(mockAuthProvider.signOut).not.toHaveBeenCalled();
    });

    it('should not sign out on 400 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 400 });

      middleware.onResponse({ response });

      expect(mockAuthProvider.signOut).not.toHaveBeenCalled();
    });
  });
});
