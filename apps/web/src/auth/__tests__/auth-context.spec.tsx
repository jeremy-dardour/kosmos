import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, useAuth, useAuthState } from '@/auth/auth-context';
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

function SignInButton() {
  const auth = useAuth();

  return (
    <button onClick={() => void auth.signIn()} type="button">
      Sign in
    </button>
  );
}

describe('authContext', () => {
  it('should expose the session state to consumers', () => {
    const auth = createStubAuth();

    render(
      <AuthContext value={auth.session}>
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
    }).toThrow('useAuth must be used within AuthContext.Provider');

    consoleError.mockRestore();
  });

  it('should expose the authenticated user', () => {
    const auth = createStubAuth();

    render(
      <AuthContext value={auth.session}>
        <PersonalComponent />
      </AuthContext>,
    );

    expect(screen.getByTestId('email')).toHaveTextContent(STUB_USER.email);
  });

  it('should expose provider actions', () => {
    const auth = createStubAuth();

    render(
      <AuthContext value={auth.session}>
        <SignInButton />
      </AuthContext>,
    );

    screen.getByRole('button', { name: 'Sign in' }).click();

    expect(auth.session.signIn).toHaveBeenCalledOnce();
  });

  it('should re-render consumers when the provider changes outside React', () => {
    const auth = createStubAuth();

    render(
      <AuthContext value={auth.session}>
        <SessionStatus />
      </AuthContext>,
    );

    expect(screen.getByText('Authenticated')).toBeInTheDocument();

    act(() => {
      auth.setState({ status: 'anonymous' });
    });

    expect(screen.getByText('Not authenticated')).toBeInTheDocument();
  });
});
