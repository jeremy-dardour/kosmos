import createFetchClient from 'openapi-fetch';

import { env } from '@/config/env';

import { createAuthMiddleware } from './middlewares/auth-middleware';

import type { AuthSession } from '@/auth/auth-session.interface';
import type { paths } from '@/types/openapi';

export function configureApiClient(session: AuthSession) {
  const fetchClient = createFetchClient<paths>({
    baseUrl: env.apiUrl,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
  });

  fetchClient.use(createAuthMiddleware(() => session));
  return fetchClient;
}
