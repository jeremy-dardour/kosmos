import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleAuthProvider } from '@/auth/google-auth-provider';

type GoogleTestGlobal = typeof globalThis & {
  google?: {
    accounts: {
      id: {
        initialize: ReturnType<typeof vi.fn>;
        prompt: ReturnType<typeof vi.fn>;
        disableAutoSelect: ReturnType<typeof vi.fn>;
      };
    };
  };
};

interface CredentialResponse {
  credential?: string;
}

interface InitializeConfig {
  client_id: string;
  callback: (response: CredentialResponse) => void;
}

describe('googleAuthProvider', () => {
  const googleGlobal = globalThis as GoogleTestGlobal;
  let credentialCallback: (response: CredentialResponse) => void;
  let token: string;

  beforeEach(() => {
    token = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    googleGlobal.google = {
      accounts: {
        id: {
          initialize: vi.fn((config: InitializeConfig) => {
            credentialCallback = config.callback;
          }),
          prompt: vi.fn(() => credentialCallback({ credential: token })),
          disableAutoSelect: vi.fn(),
        },
      },
    };
  });

  it('should initialize GIS and authenticate from credential callback', async () => {
    const provider = new GoogleAuthProvider('google-client-id');

    await provider.login();

    expect(googleGlobal.google?.accounts.id.initialize).toHaveBeenCalledWith({
      client_id: 'google-client-id',
      callback: expect.any(Function) as unknown,
    });
    expect(provider.isAuthenticated()).toBe(true);
    expect(provider.getAuthenticatedUser()).toEqual({
      username: 'jane.doe@example.com',
      name: 'Jane Doe',
    });
    await expect(provider.getAccessToken()).resolves.toBe(token);
  });

  it('should clear local state on logout', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.login();

    provider.logout();

    expect(provider.isAuthenticated()).toBe(false);
    expect(
      googleGlobal.google?.accounts.id.disableAutoSelect,
    ).toHaveBeenCalledOnce();
  });
});

function createToken(payload: Record<string, unknown>): string {
  return [
    base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
    base64UrlEncode(JSON.stringify(payload)),
    'signature',
  ].join('.');
}

function base64UrlEncode(value: string): string {
  return btoa(value)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll(/=+$/g, '');
}
