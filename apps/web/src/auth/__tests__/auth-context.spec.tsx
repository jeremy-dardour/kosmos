import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, useAuth } from '@/auth/auth-context';
import { AuthProviderBoundary } from '@/auth/auth-provider-boundary';

import type {
  AuthChangeListener,
  AuthProvider,
} from '@/auth/auth-provider.interface';

function noopUnsubscribe(): void {
  return;
}

function PersonalComponent() {
  const auth = useAuth();
  const account = auth.getAuthenticatedUser();
  return <div data-testid="email">{account?.email}</div>;
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
    restore: vi.fn(),
    login: vi.fn(),
    isAuthenticated: vi.fn().mockReturnValue(true),
    getAuthenticatedUser: vi.fn().mockReturnValue({
      id: '00000000-0000-4000-8000-000000000001',
      email: 'test@example.com',
      name: 'TestUser',
    }),
    getAuthError: vi.fn().mockReturnValue(null),
    logout: vi.fn(),
    getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
    renderSignInButton: vi.fn(),
    onChange: vi.fn(() => noopUnsubscribe),
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

      expect(screen.getByTestId('email')).toHaveTextContent('test@example.com');
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
      let listener: AuthChangeListener | undefined;
      const authProvider: AuthProvider = {
        initialize: vi.fn(),
        restore: vi.fn(),
        login: vi.fn(),
        isAuthenticated: vi.fn(() => isAuthenticated),
        getAuthenticatedUser: vi.fn().mockReturnValue(null),
        getAuthError: vi.fn().mockReturnValue(null),
        logout: vi.fn(() => {
          isAuthenticated = false;
          listener?.();
        }),
        getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
        renderSignInButton: vi.fn(),
        onChange: vi.fn((nextListener: AuthChangeListener) => {
          listener = nextListener;
          return () => {
            listener = undefined;
          };
        }),
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

    it('should refresh consumers when provider changes outside React', () => {
      let isAuthenticated = true;
      let listener: AuthChangeListener | undefined;
      const authProvider: AuthProvider = {
        initialize: vi.fn(),
        restore: vi.fn(),
        login: vi.fn(),
        isAuthenticated: vi.fn(() => isAuthenticated),
        getAuthenticatedUser: vi.fn().mockReturnValue(null),
        getAuthError: vi.fn().mockReturnValue(null),
        logout: vi.fn(() => {
          isAuthenticated = false;
          listener?.();
        }),
        getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
        renderSignInButton: vi.fn(),
        onChange: vi.fn((nextListener: AuthChangeListener) => {
          listener = nextListener;
          return () => {
            listener = undefined;
          };
        }),
      };

      render(
        <AuthProviderBoundary authProvider={authProvider}>
          <TestComponent />
        </AuthProviderBoundary>,
      );

      expect(screen.getByText('Authenticated')).toBeInTheDocument();

      act(() => {
        void authProvider.logout();
      });

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
