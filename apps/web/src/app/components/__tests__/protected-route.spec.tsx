import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/app/components/protected-route';
import { AuthContext, AuthError } from '@/auth';
import { createStubAuth } from '@/testing/stub-auth';

import type { AuthState } from '@/auth';

function renderProtectedRoute(initialState: AuthState) {
  const auth = createStubAuth(initialState);

  render(
    <AuthContext value={auth}>
      <ProtectedRoute>
        <div>Private content</div>
      </ProtectedRoute>
    </AuthContext>,
  );

  return auth;
}

describe('protectedRoute', () => {
  it('should render children when authenticated', () => {
    renderProtectedRoute({
      status: 'authenticated',
      user: { id: 'id', email: 'a@example.com', name: 'A' },
    });

    expect(screen.getByText('Private content')).toBeVisible();
  });

  it('should show the pending state while the session is restoring', () => {
    renderProtectedRoute({ status: 'restoring' });

    expect(screen.getByText('auth.landing.status.checking')).toBeVisible();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('should swap to children when the session settles as authenticated', () => {
    const auth = renderProtectedRoute({ status: 'restoring' });

    expect(screen.queryByText('Private content')).not.toBeInTheDocument();

    act(() => {
      auth.setState({
        status: 'authenticated',
        user: { id: 'id', email: 'a@example.com', name: 'A' },
      });
    });

    expect(screen.getByText('Private content')).toBeVisible();
  });

  it('should show the provider sign-in button when anonymous', () => {
    renderProtectedRoute({ status: 'anonymous' });

    expect(screen.getByText('auth.landing.status.signIn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeVisible();
    expect(screen.queryByText('Private content')).not.toBeInTheDocument();
  });

  it('should show forbidden state for disallowed accounts', async () => {
    const user = userEvent.setup();
    const auth = renderProtectedRoute({
      status: 'forbidden',
      error: new AuthError('forbidden', 'not allowed'),
    });

    expect(screen.getByText('auth.landing.status.forbidden')).toBeVisible();

    await user.click(
      screen.getByRole('button', {
        name: 'auth.landing.action.tryAnotherAccount',
      }),
    );

    expect(auth.provider.signOut).toHaveBeenCalledOnce();
  });

  it('should retry sign-in from the error state', async () => {
    const user = userEvent.setup();
    const auth = renderProtectedRoute({
      status: 'error',
      error: new AuthError('validation_failed', 'boom'),
    });

    expect(screen.getByText('auth.landing.status.error')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'auth.landing.action.retry' }),
    );

    expect(auth.provider.signIn).toHaveBeenCalledOnce();
  });
});
