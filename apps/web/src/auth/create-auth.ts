import { FakeAuthProvider } from '@/auth/fake-auth-provider';
import { GoogleAuthProvider } from '@/auth/google-auth-provider';
import { env } from '@/config/env';

import type { AuthSession } from '@/auth/auth-session.interface';

export function createAuth(): AuthSession {
  return env.fakeAuth ? new FakeAuthProvider() : new GoogleAuthProvider();
}
