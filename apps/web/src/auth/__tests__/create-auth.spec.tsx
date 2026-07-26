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
  it('should build a session the matching sign-in button drives', async () => {
    const session = createAuth();

    expect(session.getState().status).toBe('authenticated');
    session.signOut();
    expect(session.getState().status).toBe('anonymous');

    render(
      <AuthContext value={session}>
        <SignInButton />
      </AuthContext>,
    );
    screen
      .getByRole('button', { name: 'auth.landing.action.continueInDevMode' })
      .click();

    await vi.waitFor(() => {
      expect(session.getState().status).toBe('authenticated');
    });
  });
});
