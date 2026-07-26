import { useEffect, useReducer } from 'react';

import { AuthContext } from '@/auth/auth-context';

import type { AuthProvider } from '@/auth/auth-provider.interface';

interface AuthProviderBoundaryProps {
  authProvider: AuthProvider;
  children: React.ReactNode;
}

export const AuthProviderBoundary = ({
  authProvider,
  children,
}: AuthProviderBoundaryProps) => {
  const [, refresh] = useReducer((revision: number) => revision + 1, 0);

  useEffect(() => {
    return authProvider.onChange(refresh);
  }, [authProvider]);

  // Deliberately a fresh object every render — do NOT memoize this.
  // React context propagates by value identity, so a stable object would stop
  // consumers re-rendering when `refresh` fires, and auth changes would never
  // reach the UI. The cost is that consumers using `auth` as an effect
  // dependency re-run on every auth change; the fix for that is to let
  // consumers subscribe directly (useSyncExternalStore) rather than to
  // stabilise this object.
  const auth: AuthProvider = {
    initialize: () => authProvider.initialize(),
    restore: () => authProvider.restore(),
    login: () => authProvider.login(),
    logout: (error) => authProvider.logout(error),
    isAuthenticated: () => authProvider.isAuthenticated(),
    getAuthenticatedUser: () => authProvider.getAuthenticatedUser(),
    getAuthError: () => authProvider.getAuthError(),
    getAccessToken: () => authProvider.getAccessToken(),
    renderSignInButton: (container) =>
      authProvider.renderSignInButton(container),
    onChange: (listener) => authProvider.onChange(listener),
  };

  return <AuthContext value={auth}>{children}</AuthContext>;
};
