import { AuthError } from '@/auth/auth-error';
import { env } from '@/config/env';

import type { paths } from '@/types/openapi';

const CURRENT_USER_PATH = '/api/users/me' satisfies keyof paths;

export type CurrentUser =
  paths[typeof CURRENT_USER_PATH]['get']['responses'][200]['content']['application/json'];

/**
 * Resolves the server-trusted identity for a bearer token.
 *
 * - Uses `fetch` directly rather than the shared API client, because that
 *   client's auth middleware logs out on 401 — the very response this call
 *   exists to report back to its caller.
 */
export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  let response: Response;

  try {
    response = await fetch(new URL(CURRENT_USER_PATH, env.apiUrl), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    throw new AuthError(
      'validation_failed',
      error instanceof Error
        ? error.message
        : 'Could not reach the server to validate the session',
    );
  }

  if (response.ok) {
    return (await response.json()) as CurrentUser;
  }

  if (response.status === 401) {
    throw new AuthError(
      'token_rejected',
      'The server rejected this token as invalid or expired',
    );
  }

  if (response.status === 403) {
    throw new AuthError(
      'forbidden',
      'This Google account is not allowed for this app',
    );
  }

  throw new AuthError(
    'validation_failed',
    `Current user validation failed with status ${response.status}`,
  );
}
