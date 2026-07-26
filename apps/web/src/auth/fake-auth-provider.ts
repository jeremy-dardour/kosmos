import { ANONYMOUS } from '@/auth/auth-state';
import { generateFakeJwt } from '@/auth/utils/generate-fake-jwt';

import type { AuthError } from '@/auth/auth-error';
import type {
  AuthChangeListener,
  AuthProvider,
} from '@/auth/auth-provider.interface';
import type { AuthState } from '@/auth/auth-state';
import type { AuthenticatedUser } from '@/auth/types';

const DEV_USER: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dev.user@example.com',
  name: 'DevUser',
};

// provider for local developments
export class FakeAuthProvider implements AuthProvider {
  private state: AuthState = { status: 'authenticated', user: DEV_USER };
  private readonly listeners = new Set<AuthChangeListener>();

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  signIn(): Promise<void> {
    this.setState({ status: 'authenticated', user: DEV_USER });

    return Promise.resolve();
  }

  signOut(reason?: AuthError): void {
    this.setState(reason ? { status: 'error', error: reason } : ANONYMOUS);
  }

  getAccessToken(): Promise<string> {
    if (this.state.status !== 'authenticated') {
      return Promise.reject(
        new Error('[FakeAuthProvider] User is not authenticated'),
      );
    }

    return Promise.resolve(generateFakeJwt(DEV_USER.email, DEV_USER.email));
  }

  private setState(next: AuthState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
