import { createContext, use } from 'react';

import type { AuthProvider } from '@/auth';

export const AuthContext = createContext<AuthProvider | null>(null);

export function useAuth(): AuthProvider {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthContext.Provider');
  }

  return context;
}
