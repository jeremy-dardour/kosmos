import { createContext, use, useSyncExternalStore } from 'react';

import type { AuthState } from '@/auth/auth-state';
import type { AuthSession, AuthSystem } from '@/auth/auth.interface';

export const AuthContext = createContext<AuthSystem | null>(null);

export function useAuthSystem(): AuthSystem {
  const authSystem = use(AuthContext);

  if (!authSystem) {
    throw new Error('useAuthSystem must be used within AuthContext.Provider');
  }

  return authSystem;
}

export function useAuth(): AuthSession {
  return useAuthSystem().session;
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
