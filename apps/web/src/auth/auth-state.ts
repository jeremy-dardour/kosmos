import type { AuthError } from '@/auth/auth-error';
import type { AuthenticatedUser } from '@/auth/types';

/**
 * The whole of what a consumer needs to know about the session.
 *
 * - A discriminated union rather than separate `isAuthenticated` / `user` /
 *   `error` accessors, so a consumer cannot read a torn combination of the
 *   three (authenticated with no user, forbidden with no error).
 * - `restoring` is the initial status: a provider starts recovering a stored
 *   session on construction, so consumers render a pending state instead of
 *   sequencing that call themselves.
 */
export type AuthState =
  | { status: 'restoring' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'forbidden'; error: AuthError }
  | { status: 'error'; error: AuthError };

export const RESTORING: AuthState = { status: 'restoring' };
export const ANONYMOUS: AuthState = { status: 'anonymous' };
