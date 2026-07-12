import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthContext, useAuth } from '@/auth/auth-context';

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
  });
});

const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>{auth.isAuthenticated() ? 'Authenticated' : 'Not authenticated'}</div>
  );
};
