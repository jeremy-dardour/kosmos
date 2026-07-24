import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, useAuth } from '@/auth/auth-context';
import { AuthProviderBoundary } from '@/auth/auth-provider-boundary';

import type { AuthProvider } from '@/auth/auth-provider.interface';

function PersonalComponent() {
  const auth = useAuth();
  const account = auth.getAuthenticatedUser();
  return <div data-testid="username">{account?.username}</div>;
}

function LoginButton() {
  const auth = useAuth();
  return (
    <button onClick={() => auth.login()} type="button">
      Login
    </button>
  );
}

function LogoutStatus() {
  const auth = useAuth();
  return (
    <>
      <span>
        {auth.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}
      </span>
      <button onClick={() => auth.logout()} type="button">
        Logout
      </button>
    </>
  );
}

describe('authContext', () => {
  const mockAuthProvider: AuthProvider = {
    initialize: vi.fn(),
    login: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAuthenticatedUser: vi.fn().mockReturnValue({
      username: 'test@example.com',
      name: 'TestUser',
      localAccountId: 'testId',
    }),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
  };

  describe('useAuth', () => {
    it('should return auth provider when used within AuthContext', () => {
      render(
        <AuthContext value={mockAuthProvider}>
          <TestComponent />
        </AuthContext>,
      );

      expect(screen.getByText('Authenticated')).toBeInTheDocument();
    });

    it('should throw error when used outside AuthContext', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {
        return;
      });

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within AuthContext.Provider');

      consoleError.mockRestore();
    });

    it('should return the correct auth provider instance', () => {
      render(
        <AuthContext value={mockAuthProvider}>
          <PersonalComponent />
        </AuthContext>,
      );

      expect(screen.getByTestId('username')).toHaveTextContent(
        'test@example.com',
      );
    });

    it('should allow calling auth provider methods', () => {
      render(
        <AuthContext value={mockAuthProvider}>
          <LoginButton />
        </AuthContext>,
      );

      const button = screen.getByRole('button', { name: 'Login' });
      button.click();

      expect(mockAuthProvider.login).toHaveBeenCalledOnce();
    });

    it('should refresh consumers after auth boundary logout', async () => {
      let isAuthenticated = true;
      const authProvider: AuthProvider = {
        initialize: vi.fn(),
        login: vi.fn(),
        isAuthenticated: vi.fn(() => isAuthenticated),
        getAuthenticatedUser: vi.fn().mockReturnValue(null),
        logout: vi.fn(() => {
          isAuthenticated = false;
        }),
        getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
      };

      render(
        <AuthProviderBoundary authProvider={authProvider}>
          <LogoutStatus />
        </AuthProviderBoundary>,
      );

      expect(screen.getByText('Authenticated')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', { name: 'Logout' }));

      expect(screen.getByText('Not authenticated')).toBeInTheDocument();
    });
  });
});

const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>{auth.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}</div>
  );
};
