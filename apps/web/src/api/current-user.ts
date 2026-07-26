import { AuthError } from '@/auth/auth-error';
import { env } from '@/config/env';

import type { dtos } from '@/types/openapi';

export type CurrentUser = dtos['CurrentUserDto'];

/**
 * Resolves the server-trusted identity behind a bearer token.
 *
 * This is deliberately independent of any identity provider: acquiring a token
 * is Google-specific, but exchanging one for "who is this in our app" is not.
 *
 * It also deliberately uses `fetch` rather than the shared API client. This
 * runs *during* authentication, before a session exists, and the client's auth
 * middleware logs the user out on 401 — which is precisely the response this
 * call exists to report back to its caller.
 */
export async function fetchCurrentUser(token: string): Promise<CurrentUser> {
  let response: Response;

  try {
    response = await fetch(new URL('/api/users/me', env.apiUrl), {
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
