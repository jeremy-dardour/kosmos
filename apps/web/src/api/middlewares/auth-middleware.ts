import type { AuthSession } from '@/auth/auth-session.interface';

export function createAuthMiddleware(getAuth: () => AuthSession | null) {
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

    onResponse({ response }: { response: Response }) {
      const auth = getAuth();
      // Only 401: this API uses 403 for domain permissions, so treating it as
      // auth invalidation would sign users out of ordinary feature denials.
      if (response.status === 401 && auth) {
        console.warn('[AuthMiddleware] Received 401 response, logging out');
        auth.signOut();
      }
    },
  };
}
