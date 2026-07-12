import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayoutHeader } from '@/app/components/layout/layout-header';
import { AuthContext } from '@/auth';

import type { AuthProvider } from '@/auth';

const mockAuthProvider: AuthProvider = {
  initialize: vi.fn(),
  login: vi.fn(),
  isAuthenticated: vi.fn().mockReturnValue(true),
  getAuthenticatedUser: vi.fn().mockReturnValue({
    username: 'jane.doe@example.com',
    name: 'Jane Doe',
  }),
  logout: vi.fn(),
  getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
};

const setup = () => {
  render(
    <AuthContext value={mockAuthProvider}>
      <LayoutHeader />
    </AuthContext>,
  );
};

describe('layoutHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setup();
  });

  it('should render the app title', () => {
    const title = screen.getByText('app.logo.description');
    expect(title).toBeInTheDocument();
  });

  it('should render the user name', () => {
    const username = screen.getByText('Jane Doe');
    expect(username).toBeVisible();
  });

  it('should show display signout button', async () => {
    const button = screen.getByText('Jane Doe');
    await userEvent.click(button);

    expect(screen.getByText('app.userMenu.logout')).toBeVisible();
  });

  it('should call logout when logout button is clicked', async () => {
    const mockLogout = vi.fn();
    mockAuthProvider.logout = mockLogout;
    const button = screen.getByText('Jane Doe');
    await userEvent.click(button);

    const logoutButton = screen.getByText('app.userMenu.logout');
    await userEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('should navigate to home page when title is clicked', async () => {
    const title = screen.getByText('app.logo.description');
    await userEvent.click(title);

    expect(globalThis.location.href).toBe('http://localhost:3000/');
  });
});
