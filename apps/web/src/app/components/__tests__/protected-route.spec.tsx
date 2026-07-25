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
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('should login and render children when authentication succeeds', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      login: () => {
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
    expect(auth.login).toHaveBeenCalledOnce();
  });

  it('should show sign-in state when prompt is dismissed', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      login: () =>
        Promise.reject(
          new AuthError(
            'sign_in_failed',
            'Google sign-in prompt was dismissed',
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

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledOnce();
    });

    expect(screen.getByText('Sign-in is required to continue.')).toBeVisible();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('should show forbidden state for disallowed accounts', async () => {
    const auth = createAuthProvider({
      isAuthenticated: false,
      login: () =>
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
      await screen.findByText('This Google account is not allowed.'),
    ).toBeVisible();
  });

  it('should retry login when sign-in button is clicked', async () => {
    const user = userEvent.setup();
    const auth = createAuthProvider({
      isAuthenticated: false,
      login: () =>
        Promise.reject(
          new AuthError(
            'sign_in_failed',
            'Google sign-in prompt was dismissed',
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
      await screen.findByText('Sign-in is required to continue.'),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Sign in with Google' }),
    );

    await waitFor(() => {
      expect(auth.login).toHaveBeenCalledTimes(2);
    });
  });
});

function createAuthProvider({
  isAuthenticated,
  login,
}: {
  isAuthenticated: boolean;
  login?: () => Promise<void>;
}): AuthProvider & {
  setAuthenticated: (isAuthenticatedValue: boolean) => void;
} {
  let isAuthenticatedState = isAuthenticated;

  return {
    initialize: vi.fn(),
    login: vi.fn(login ?? (() => Promise.resolve())),
    logout: vi.fn(),
    isAuthenticated: vi.fn(() => isAuthenticatedState),
    getAuthenticatedUser: vi.fn(() => null),
    getAccessToken: vi.fn(() => Promise.resolve('token')),
    setAuthenticated: (isAuthenticatedValue: boolean) => {
      isAuthenticatedState = isAuthenticatedValue;
    },
  };
}
