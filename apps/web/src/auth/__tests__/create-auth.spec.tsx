import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    fakeAuth: true,
    dev: true,
    apiUrl: 'http://localhost:3000',
  },
}));

import { AuthContext } from '@/auth/auth-context';
import { createAuth } from '@/auth/create-auth';
import { SignInButton } from '@/auth/sign-in-button';

describe('createAuth', () => {
  it('should build an auth the matching sign-in button drives', async () => {
    const auth = createAuth();

    expect(auth.getState().status).toBe('authenticated');
    auth.signOut();
    expect(auth.getState().status).toBe('anonymous');

    render(
      <AuthContext value={auth}>
        <SignInButton />
      </AuthContext>,
    );
    screen
      .getByRole('button', { name: 'auth.landing.action.continueInDevMode' })
      .click();

    await vi.waitFor(() => {
      expect(auth.getState().status).toBe('authenticated');
    });
  });
});
