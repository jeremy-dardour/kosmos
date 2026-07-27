import { createElement } from 'react';
import { vi } from 'vitest';

import type { AuthState } from '@/auth/auth-state';
import type { AuthSession, AuthSystem } from '@/auth/auth.interface';

export const STUB_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test@example.com',
  name: 'TestUser',
};

/** `setState` notifies subscribers, so wrap the call in `act`. */
export function createStubAuth(initialState?: AuthState): {
  auth: AuthSession;
  authSystem: AuthSystem;
  setState: (next: AuthState) => void;
} {
  let state: AuthState = initialState ?? {
    status: 'authenticated',
    user: STUB_USER,
  };
  const listeners = new Set<() => void>();

  const auth: AuthSession = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signOut: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
  };
  const authSystem: AuthSystem = {
    session: auth,
    SignInButton: () =>
      createElement(
        'button',
        { type: 'button' },
        'auth.landing.action.continueInDevMode',
      ),
  };

  const setState = (next: AuthState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return { auth, authSystem, setState };
}
