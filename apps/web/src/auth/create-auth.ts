import { FakeAuthProvider } from '@/auth/fake-auth-provider';
import { GoogleAuthProvider } from '@/auth/google-auth-provider';
import { env } from '@/config/env';

import type { Auth } from '@/auth/auth.interface';

export function createAuth(): Auth {
  return env.fakeAuth ? new FakeAuthProvider() : new GoogleAuthProvider();
}
