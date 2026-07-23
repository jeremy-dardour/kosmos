import { generateFakeJwt } from '@/auth/utils/generate-fake-jwt';

import { AuthEvent } from './types';

import type { AuthenticatedUser } from './types';
import type { AuthProvider } from '@/auth/auth-provider.interface';

// provider for local developments
export class FakeAuthProvider implements AuthProvider {
  private authenticated = false;
  private authenticatedUser: AuthenticatedUser = this.mockAuthenticateUser();

  initialize(): void {
    this.authenticated = true;
    this.dispatch(AuthEvent.LOGIN_SUCCESS);
  }

  login(): void {
    this.authenticated = true;
    this.dispatch(AuthEvent.LOGIN_SUCCESS);
  }

  logout(): void {
    this.authenticated = false;
    this.dispatch(AuthEvent.LOGOUT_SUCCESS);
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.authenticated ? this.authenticatedUser : null;
  }

  getAccessToken(): Promise<string> {
    if (!this.authenticated) {
      return Promise.reject(
        new Error('[FakeAuthProvider] User is not authenticated'),
      );
    }

    const { username } = this.mockAuthenticateUser();

    return Promise.resolve(generateFakeJwt(username, username));
  }

  private mockAuthenticateUser() {
    return {
      username: 'dev.user@example.com',
      name: 'DevUser',
    };
  }

  private dispatch(type: AuthEvent): void {
    globalThis.dispatchEvent(new CustomEvent(type));
  }
}
