import type { AuthError } from '@/auth/auth-error';
import type { AuthenticatedUser } from '@/auth/types';

export type AuthChangeListener = () => void;

export interface AuthProvider {
  initialize(): void | Promise<void>;
  restore(): void | Promise<void>;
  login(): void | Promise<void>;
  logout(error?: AuthError): void | Promise<void>;
  isAuthenticated(): boolean;
  getAuthenticatedUser(): AuthenticatedUser | null;
  getAuthError(): AuthError | null;
  getAccessToken(): Promise<string>;
  renderSignInButton(
    container: HTMLElement,
  ): void | (() => void) | Promise<void | (() => void)>;
  onChange(listener: AuthChangeListener): () => void;
}
