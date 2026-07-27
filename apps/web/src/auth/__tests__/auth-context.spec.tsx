import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, useAuthState } from '@/auth/auth-context';
import { SignInButton } from '@/auth/sign-in-button';
import { createStubAuth, STUB_USER } from '@/testing/stub-auth';

function SessionStatus() {
  const state = useAuthState();

  return (
    <div>
      {state.status === 'authenticated' ? 'Authenticated' : 'Not authenticated'}
    </div>
  );
}

function PersonalComponent() {
  const state = useAuthState();

  return (
    <div data-testid="email">
      {state.status === 'authenticated' ? state.user.email : null}
    </div>
  );
}

describe('authContext', () => {
  it('should expose the session state to consumers', () => {
    const { authSystem } = createStubAuth();

    render(
      <AuthContext value={authSystem}>
        <SessionStatus />
      </AuthContext>,
    );

    expect(screen.getByText('Authenticated')).toBeInTheDocument();
  });

  it('should throw when used outside AuthContext', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
      return;
    });

    expect(() => {
      render(<SessionStatus />);
    }).toThrow('useAuthSystem must be used within AuthContext.Provider');

    consoleError.mockRestore();
  });

  it('should expose the authenticated user', () => {
    const { authSystem } = createStubAuth();

    render(
      <AuthContext value={authSystem}>
        <PersonalComponent />
      </AuthContext>,
    );

    expect(screen.getByTestId('email')).toHaveTextContent(STUB_USER.email);
  });

  it('should expose the provider sign-in affordance', () => {
    const { authSystem } = createStubAuth();

    render(
      <AuthContext value={authSystem}>
        <SignInButton />
      </AuthContext>,
    );

    expect(
      screen.getByRole('button', {
        name: 'auth.landing.action.continueInDevMode',
      }),
    ).toBeVisible();
  });

  it('should re-render consumers when the provider changes outside React', () => {
    const { authSystem, setState } = createStubAuth();

    render(
      <AuthContext value={authSystem}>
        <SessionStatus />
      </AuthContext>,
    );

    expect(screen.getByText('Authenticated')).toBeInTheDocument();

    act(() => {
      setState({ status: 'anonymous' });
    });

    expect(screen.getByText('Not authenticated')).toBeInTheDocument();
  });
});
