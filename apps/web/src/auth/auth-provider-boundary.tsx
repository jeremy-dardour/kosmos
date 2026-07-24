import { useReducer } from 'react';

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

  const auth: AuthProvider = {
    initialize: () => authProvider.initialize(),
    login: async () => {
      await authProvider.login();
      refresh();
    },
    logout: async () => {
      await authProvider.logout();
      refresh();
    },
    isAuthenticated: () => authProvider.isAuthenticated(),
    getAuthenticatedUser: () => authProvider.getAuthenticatedUser(),
    getAccessToken: () => authProvider.getAccessToken(),
  };

  return <AuthContext value={auth}>{children}</AuthContext>;
};
