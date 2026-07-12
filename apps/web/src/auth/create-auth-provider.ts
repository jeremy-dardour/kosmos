import { FakeAuthProvider } from './fake-auth-provider';

import type { AuthProvider } from '@/auth';

export function createAuthProvider(): AuthProvider {
  const provider = new FakeAuthProvider();

  provider.initialize();
  return provider;
}
