import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ProtectedRoute } from '@/app/components/protected-route';
import { AuthContext, AuthError } from '@/auth';

import type { AuthProvider } from '@/auth';

describe('protectedRoute', () => {
  it('should render children when already authenticated', () => {
    const auth = createAuthProvider({ isAuthenticated: true });

    render(
      <AuthContext value={auth}>
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>
      </AuthContext>,
    );

    expect(screen.getByText('Private content')).toBeVisible();
    expect(auth.restore).not.toHaveBeenCalled();
  });

  it('should restore and render children when authentication succeeds', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      restore: () => {
        auth.setAuthenticated(true);
        return Promise.resolve();
      },
    });

    render(
      <AuthContext value={auth}>
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>
      </AuthContext>,
    );

    expect(screen.queryByText('Private content')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Private content')).toBeVisible();
    });
    expect(auth.restore).toHaveBeenCalledOnce();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('should show sign-in landing immediately when no session is restored', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      restore: () => Promise.resolve(),
    });

    render(
      <AuthContext value={auth}>
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>
      </AuthContext>,
    );

    expect(await screen.findByText('auth.landing.status.signIn')).toBeVisible();
    expect(screen.getByText('Mock Google sign-in')).toBeVisible();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('should show forbidden state for disallowed accounts', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      restore: () =>
        Promise.reject(
          new AuthError(
            'forbidden',
            'This Google account is not allowed for this app',
          ),
        ),
    });

    render(
      <AuthContext value={auth}>
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>
      </AuthContext>,
    );

    expect(
      await screen.findByText('auth.landing.status.forbidden'),
    ).toBeVisible();
  });

  it('should retry restore when retry button is clicked', async () => {
    const user = userEvent.setup();
    const auth = createAuthProvider({
      isAuthenticated: false,
      restore: () => Promise.reject(new Error('Validation failed')),
    });

    render(
      <AuthContext value={auth}>
        <ProtectedRoute>
          <div>Private content</div>
        </ProtectedRoute>
      </AuthContext>,
    );

    expect(await screen.findByText('auth.landing.status.error')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'auth.landing.action.retry' }),
    );

    await waitFor(() => {
      expect(auth.restore).toHaveBeenCalledTimes(2);
    });
  });
});

function createAuthProvider({
  isAuthenticated,
  restore,
  login,
}: {
  isAuthenticated: boolean;
  restore?: () => Promise<void>;
  login?: () => Promise<void>;
}): AuthProvider & {
  setAuthenticated: (isAuthenticatedValue: boolean) => void;
} {
  let isAuthenticatedState = isAuthenticated;

  return {
    initialize: vi.fn(),
    restore: vi.fn(restore ?? (() => Promise.resolve())),
    login: vi.fn(login ?? (() => Promise.resolve())),
    logout: vi.fn(),
    isAuthenticated: vi.fn(() => isAuthenticatedState),
    getAuthenticatedUser: vi.fn(() => null),
    getAuthError: vi.fn(() => null),
    getAccessToken: vi.fn(() => Promise.resolve('token')),
    renderSignInButton: vi.fn((container: HTMLElement) => {
      const button = document.createElement('button');
      button.textContent = 'Mock Google sign-in';
      container.append(button);
    }),
    onChange: vi.fn(),
    setAuthenticated: (isAuthenticatedValue: boolean) => {
      isAuthenticatedState = isAuthenticatedValue;
    },
  };
}
