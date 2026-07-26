import { vi } from 'vitest';

import type { AuthSession } from '@/auth/auth-session.interface';
import type { AuthState } from '@/auth/auth-state';

export const STUB_USER = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'test@example.com',
  name: 'TestUser',
};

/** `setState` notifies subscribers, so wrap the call in `act`. */
export function createStubAuth(initialState?: AuthState): {
  session: AuthSession;
  setState: (next: AuthState) => void;
} {
  let state: AuthState = initialState ?? {
    status: 'authenticated',
    user: STUB_USER,
  };
  const listeners = new Set<() => void>();

  const session: AuthSession = {
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

  return { session, setState };
}
