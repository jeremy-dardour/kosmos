import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthMiddleware } from '@/api/middlewares/auth-middleware';
import { createStubAuth } from '@/testing/stub-auth';

import type { Auth } from '@/auth/auth.interface';

describe('createAuthMiddleware', () => {
  let mockAuth: Auth;
  let getAuth: ReturnType<typeof vi.fn<() => Auth | null>>;

  beforeEach(() => {
    mockAuth = createStubAuth().auth;
    mockAuth.getAccessToken = vi.fn().mockResolvedValue('test-token-123');

    getAuth = vi.fn<() => Auth | null>().mockReturnValue(mockAuth);
  });

  describe('onRequest', () => {
    it('should add Authorization header when token is available', async () => {
      const middleware = createAuthMiddleware(getAuth);
      const request = new Request('http://localhost/api/test');

      await middleware.onRequest({ request });

      expect(mockAuth.getAccessToken).toHaveBeenCalled();
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
      mockAuth.getAccessToken = vi.fn().mockResolvedValueOnce('');
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

      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    it('should not sign out on 403 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 403 });

      middleware.onResponse({ response });

      expect(mockAuth.signOut).not.toHaveBeenCalled();
    });

    it('should not sign out on 200 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 200 });

      middleware.onResponse({ response });

      expect(mockAuth.signOut).not.toHaveBeenCalled();
    });

    it('should not sign out on 400 response', () => {
      const middleware = createAuthMiddleware(getAuth);
      const response = new Response(null, { status: 400 });

      middleware.onResponse({ response });

      expect(mockAuth.signOut).not.toHaveBeenCalled();
    });
  });
});
