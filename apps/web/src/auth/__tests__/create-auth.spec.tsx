import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    fakeAuth: true,
    dev: true,
    apiUrl: 'http://localhost:3000',
  },
}));

import { createAuth } from '@/auth/create-auth';

describe('createAuth', () => {
  it('should pair the fake provider with a sign-in button that drives it', async () => {
    const { provider, signInButton } = createAuth();

    expect(provider.getState().status).toBe('authenticated');
    provider.signOut();
    expect(provider.getState().status).toBe('anonymous');

    render(signInButton);
    screen
      .getByRole('button', { name: 'auth.landing.action.continueInDevMode' })
      .click();

    await vi.waitFor(() => {
      expect(provider.getState().status).toBe('authenticated');
    });
  });
});
