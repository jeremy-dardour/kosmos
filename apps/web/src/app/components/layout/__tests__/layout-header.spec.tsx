import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LayoutHeader } from '@/app/components/layout/layout-header';
import { AuthContext } from '@/auth';
import { createStubAuth } from '@/testing/stub-auth';

import type { AuthSession } from '@/auth';

const setup = () => {
  const { auth, authSystem } = createStubAuth({
    status: 'authenticated',
    user: {
      id: '00000000-0000-4000-8000-000000000010',
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
    },
  });

  render(
    <MemoryRouter initialEntries={['/projects/p1']}>
      <AuthContext value={authSystem}>
        <LayoutHeader />
      </AuthContext>
    </MemoryRouter>,
  );

  return auth;
};

describe('layoutHeader', () => {
  let auth: AuthSession;

  beforeEach(() => {
    vi.clearAllMocks();
    auth = setup();
  });

  it('should render the app title', () => {
    const title = screen.getByText('Kosmos');
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
    const button = screen.getByText('Jane Doe');
    await userEvent.click(button);

    const logoutButton = screen.getByText('app.userMenu.logout');
    await userEvent.click(logoutButton);

    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('should link the title to the home page', () => {
    const title = screen.getByRole('link', { name: 'app.logo.description' });

    expect(title).toHaveAttribute('href', '/');
  });
});
