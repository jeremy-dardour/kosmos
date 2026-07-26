import { createContext, use, useSyncExternalStore } from 'react';

import type { AuthSession } from '@/auth/auth-session.interface';
import type { AuthState } from '@/auth/auth-state';

export const AuthContext = createContext<AuthSession | null>(null);

export function useAuth(): AuthSession {
  const session = use(AuthContext);

  if (!session) {
    throw new Error('useAuth must be used within AuthContext.Provider');
  }

  return session;
}

/**
 * `useSyncExternalStore` rather than a changing context value: it keeps the
 * context value stable, so `useAuth()` is safe in a dependency array.
 */
export function useAuthState(): AuthState {
  const session = useAuth();

  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getState(),
  );
}
