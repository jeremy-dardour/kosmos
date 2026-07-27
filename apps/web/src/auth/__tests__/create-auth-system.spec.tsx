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
import { createAuthSystem } from '@/auth/create-auth-system';
import { SignInButton } from '@/auth/sign-in-button';

describe('createAuthSystem', () => {
  it('should compose a session with the sign-in button that drives it', async () => {
    const authSystem = createAuthSystem();
    const { session } = authSystem;

    expect(session.getState().status).toBe('authenticated');
    session.signOut();
    expect(session.getState().status).toBe('anonymous');

    render(
      <AuthContext value={authSystem}>
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
