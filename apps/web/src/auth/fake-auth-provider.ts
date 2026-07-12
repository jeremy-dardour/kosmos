import { generateFakeJwt } from '@/auth/utils/generate-fake-jwt';

import type { AuthenticatedUser } from './types';
import type { AuthProvider } from '@/auth/auth-provider.interface';

// provider for local developments
export class FakeAuthProvider implements AuthProvider {
  private authenticated = false;
  private authenticatedUser: AuthenticatedUser = this.mockAuthenticateUser();

  initialize(): void {
    this.authenticated = true;
  }

  login(): void {
    this.authenticated = true;
  }

  logout(): void {
    this.authenticated = false;
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
}
