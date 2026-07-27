import { createContext, use, useSyncExternalStore } from 'react';

import type { AuthState } from '@/auth/auth-state';
import type { Auth } from '@/auth/auth.interface';

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = use(AuthContext);

  if (!auth) {
    throw new Error('useAuth must be used within AuthContext.Provider');
  }

  return auth;
}

/**
 * `useSyncExternalStore` rather than a changing context value: it keeps the
 * context value stable, so `useAuth()` is safe in a dependency array.
 */
export function useAuthState(): AuthState {
  const auth = useAuth();

  return useSyncExternalStore(
    (listener) => auth.subscribe(listener),
    () => auth.getState(),
  );
}
