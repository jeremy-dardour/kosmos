import type { AuthError } from '@/auth/auth-error';
import type { AuthenticatedUser } from '@/auth/types';

export type AuthState =
  | { status: 'restoring' } // the initial status: recovering a stored session
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'forbidden'; error: AuthError }
  | { status: 'error'; error: AuthError };

// Shared singletons because they carry no data and `setState` dedupes by
// reference. The three states that carry a payload cannot be shared this way.
export const RESTORING: AuthState = { status: 'restoring' };
export const ANONYMOUS: AuthState = { status: 'anonymous' };
