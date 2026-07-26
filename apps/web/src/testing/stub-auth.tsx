import { vi } from 'vitest';

import type { AuthProvider } from '@/auth/auth-provider.interface';
import type { AuthState } from '@/auth/auth-state';
import type { Auth } from '@/auth/create-auth';

export const STUB_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test@example.com',
  name: 'TestUser',
};

/**
 * An `AuthProvider` double whose state can be driven from a test.
 *
 * - `setState` notifies subscribers the way a real provider does, so consumers
 *   reading through `useSyncExternalStore` re-render. Wrap the call in `act`.
 */
export function createStubAuthProvider(initialState?: AuthState) {
  let state: AuthState = initialState ?? {
    status: 'authenticated',
    user: STUB_USER,
  };
  const listeners = new Set<() => void>();

  const provider: AuthProvider = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
  };

  const setState = (next: AuthState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  return { provider, setState };
}

export function createStubAuth(initialState?: AuthState): Auth & {
  setState: (next: AuthState) => void;
} {
  const { provider, setState } = createStubAuthProvider(initialState);

  return {
    provider,
    signInButton: <button type="button">Sign in</button>,
    setState,
  };
}
