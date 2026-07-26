import { FakeAuthProvider } from '@/auth/fake-auth-provider';
import { FakeSignInButton } from '@/auth/fake-sign-in-button';
import { GoogleAuthProvider } from '@/auth/google-auth-provider';
import { GoogleSignInButton } from '@/auth/google-sign-in-button';
import { env } from '@/config/env';

import type { AuthProvider } from '@/auth/auth-provider.interface';

export interface Auth {
  provider: AuthProvider;
  signInButton: React.ReactNode;
}

/**
 * Builds the session state machine together with the sign-in affordance that
 * matches it.
 *
 * - The two are returned as a pair because only this function knows the
 *   concrete provider, and the widget is provider specific — Google renders
 *   its own iframe button, the fake needs nothing but an onClick.
 * - The widget is an element rather than a component type, built once here, so
 *   rendering it never creates a component during another component's render.
 */
export function createAuth(): Auth {
  if (env.fakeAuth) {
    const provider = new FakeAuthProvider();

    return {
      provider,
      signInButton: <FakeSignInButton provider={provider} />,
    };
  }

  const provider = new GoogleAuthProvider();

  return {
    provider,
    signInButton: <GoogleSignInButton provider={provider} />,
  };
}
