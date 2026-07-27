import { FakeAuthProvider } from '@/auth/fake-auth-provider';
import { FakeSignInButton } from '@/auth/fake-sign-in-button';
import { GoogleAuthProvider } from '@/auth/google-auth-provider';
import { GoogleSignInButton } from '@/auth/google-sign-in-button';
import { env } from '@/config/env';

import type { AuthSystem } from '@/auth/auth.interface';

export function createAuthSystem(): AuthSystem {
  if (env.fakeAuth) {
    const session = new FakeAuthProvider();

    return {
      session,
      SignInButton: () => <FakeSignInButton provider={session} />,
    };
  }

  const session = new GoogleAuthProvider();

  return {
    session,
    SignInButton: () => <GoogleSignInButton provider={session} />,
  };
}
