import { AuthError } from '@/auth/auth-error';

import type { AuthProvider } from '@/auth/auth-provider.interface';

export function createAuthMiddleware(getAuth: () => AuthProvider | null) {
  return {
    async onRequest({ request }: { request: Request }) {
      const auth = getAuth();
      if (!auth) return;

      try {
        const token = await auth.getAccessToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      } catch (error) {
        console.error('[AuthMiddleware] token error', error);
      }
    },

    // Only 401 invalidates the session here. A 403 from ordinary traffic is a
    // domain permission failure, not an auth failure — and session validation
    // (`/users/me`) does not go through this client at all, it is handled by
    // `fetchCurrentUser`, which maps 401/403 itself.
    async onResponse({ response }: { response: Response }) {
      const auth = getAuth();
      if (response.status === 401 && auth) {
        console.warn('[AuthMiddleware] Received 401 response, logging out');
        await auth.logout(
          new AuthError('validation_failed', 'Authentication expired'),
        );
      }
    },
  };
}
