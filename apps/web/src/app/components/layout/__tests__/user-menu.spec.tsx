import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserMenu } from '@/app/components/layout/user-menu';
import { AuthContext } from '@/auth';

import type { AuthProvider } from '@/auth';

const mockAuthProvider: AuthProvider = {
  initialize: vi.fn(),
  restore: vi.fn(),
  login: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(true),
  getAuthenticatedUser: vi.fn().mockReturnValue({
    id: '00000000-0000-4000-8000-000000000010',
    email: 'jane.doe@example.com',
    name: 'Jane Doe',
  }),
  getAuthError: vi.fn().mockReturnValue(null),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
  renderSignInButton: vi.fn(),
  onChange: vi.fn(),
};

const setup = () => {
  render(
    <AuthContext value={mockAuthProvider}>
      <UserMenu />
    </AuthContext>,
  );
};

describe('userMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('should render the user name', () => {
    expect(screen.getByText('Jane Doe')).toBeVisible();
  });

  it('should show logout option when trigger is clicked', async () => {
    await userEvent.click(screen.getByText('Jane Doe'));

    expect(screen.getByText('app.userMenu.logout')).toBeVisible();
  });

  it('should call logout when logout option is clicked', async () => {
    const mockLogout = vi.fn();
    mockAuthProvider.logout = mockLogout;

    await userEvent.click(screen.getByText('Jane Doe'));
    await userEvent.click(screen.getByText('app.userMenu.logout'));

    expect(mockLogout).toHaveBeenCalledOnce();
  });
});
