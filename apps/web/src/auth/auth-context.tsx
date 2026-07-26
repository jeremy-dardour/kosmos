import { createContext, use, useSyncExternalStore } from 'react';

import type { AuthProvider } from '@/auth/auth-provider.interface';
import type { AuthState } from '@/auth/auth-state';
import type { Auth } from '@/auth/create-auth';

export const AuthContext = createContext<Auth | null>(null);

function useAuthContext(): Auth {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthContext.Provider');
  }

  return context;
}

/** The session state machine — use for actions (`signIn`, `signOut`). */
export function useAuth(): AuthProvider {
  return useAuthContext().provider;
}

/**
 * Subscribes to the session and re-renders on every change.
 *
 * - `useSyncExternalStore` rather than a context value that changes identity:
 *   the provider is an external mutable source, and this is React's primitive
 *   for exactly that. It also keeps the context value stable, so consumers can
 *   safely put `useAuth()` in a dependency array.
 */
export function useAuthState(): AuthState {
  const { provider } = useAuthContext();

  return useSyncExternalStore(
    (listener) => provider.subscribe(listener),
    () => provider.getState(),
  );
}

export function useSignInButton(): React.ReactNode {
  return useAuthContext().signInButton;
}
