import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserMenu } from '@/app/components/layout/user-menu';
import { AuthContext } from '@/auth';
import { createStubAuth } from '@/testing/stub-auth';

const setup = () => {
  const auth = createStubAuth({
    status: 'authenticated',
    user: {
      id: '00000000-0000-4000-8000-000000000010',
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
    },
  });

  render(
    <AuthContext value={auth}>
      <UserMenu />
    </AuthContext>,
  );

  return auth;
};

describe('userMenu', () => {
  let auth: ReturnType<typeof createStubAuth>;

  beforeEach(() => {
    vi.clearAllMocks();
    auth = setup();
  });

  it('should render the user name', () => {
    expect(screen.getByText('Jane Doe')).toBeVisible();
  });

  it('should show logout option when trigger is clicked', async () => {
    await userEvent.click(screen.getByText('Jane Doe'));

    expect(screen.getByText('app.userMenu.logout')).toBeVisible();
  });

  it('should call logout when logout option is clicked', async () => {
    await userEvent.click(screen.getByText('Jane Doe'));
    await userEvent.click(screen.getByText('app.userMenu.logout'));

    expect(auth.provider.signOut).toHaveBeenCalledOnce();
  });
});
