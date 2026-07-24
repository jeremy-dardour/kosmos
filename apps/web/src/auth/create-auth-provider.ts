import { env } from '@/config/env';

import { FakeAuthProvider } from './fake-auth-provider';
import { GoogleAuthProvider } from './google-auth-provider';

import type { AuthProvider } from '@/auth';

export function createAuthProvider(): AuthProvider {
  if (!env.fakeAuth) {
    return new GoogleAuthProvider();
  }

  const provider = new FakeAuthProvider();
  void provider.initialize();
  return provider;
}
