import type { AuthenticatedUser } from '@/auth/types';

export interface AuthProvider {
  initialize(): void | Promise<void>;
  login(): void | Promise<void>;
  logout(): void | Promise<void>;
  isAuthenticated(): boolean;
  getAuthenticatedUser(): AuthenticatedUser | null;
  getAccessToken(): Promise<string>;
}
