import { env } from '@/config/env';

import { FakeAuthProvider } from './fake-auth-provider';
import { GoogleAuthProvider } from './google-auth-provider';

import type { AuthProvider } from '@/auth';

export function createAuthProvider(): AuthProvider {
  const provider = env.fakeAuth
    ? new FakeAuthProvider()
    : new GoogleAuthProvider();

  void provider.initialize();
  return provider;
}
