import { generateFakeJwt } from '@/auth/utils/generate-fake-jwt';

import type { AuthenticatedUser } from './types';
import type { AuthError } from '@/auth/auth-error';
import type {
  AuthChangeListener,
  AuthProvider,
} from '@/auth/auth-provider.interface';

// provider for local developments
export class FakeAuthProvider implements AuthProvider {
  private authenticated = false;
  private authError: AuthError | null = null;
  private authenticatedUser: AuthenticatedUser = this.mockAuthenticateUser();
  private readonly listeners = new Set<AuthChangeListener>();

  initialize(): void {
    this.authenticate();
  }

  restore(): void {
    this.authenticate();
  }

  login(): void {
    this.authenticate();
  }

  logout(error?: AuthError): void {
    this.authenticated = false;
    this.authError = error ?? null;
    this.emitChange();
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.authenticated ? this.authenticatedUser : null;
  }

  getAuthError(): AuthError | null {
    return this.authError;
  }

  getAccessToken(): Promise<string> {
    if (!this.authenticated) {
      return Promise.reject(
        new Error('[FakeAuthProvider] User is not authenticated'),
      );
    }

    const { email } = this.mockAuthenticateUser();

    return Promise.resolve(generateFakeJwt(email, email));
  }

  renderSignInButton(container: HTMLElement): () => void {
    // Append rather than replace, and clean up only our own node — the caller's
    // effect may run twice under StrictMode. See GoogleAuthProvider.
    const button = globalThis.document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue in dev mode';
    button.addEventListener('click', () => this.login());
    container.append(button);

    return () => {
      button.remove();
    };
  }

  onChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private authenticate(): void {
    this.authenticated = true;
    this.authError = null;
    this.emitChange();
  }

  private mockAuthenticateUser() {
    return {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'dev.user@example.com',
      name: 'DevUser',
    };
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
