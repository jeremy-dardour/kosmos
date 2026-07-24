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

interface PromptNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}

const googleAuthTestState: {
  credentialCallback?: (response: CredentialResponse) => void;
} = {};

describe('googleAuthProvider', () => {
  const googleGlobal = globalThis as GoogleTestGlobal;
  let token: string;

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete googleGlobal.google;
    googleAuthTestState.credentialCallback = undefined;

    token = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: token }),
    });
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

  it('should reuse the pending login promise for concurrent login calls', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({ prompt: noop });

    const firstLogin = provider.login();
    const secondLogin = provider.login();

    expect(secondLogin).toBe(firstLogin);
    await vi.waitFor(() => {
      expect(googleGlobal.google?.accounts.id.prompt).toHaveBeenCalledOnce();
    });

    handleCredential({ credential: token });
    await expect(firstLogin).resolves.toBeUndefined();
    await expect(secondLogin).resolves.toBeUndefined();
  });

  it('should reject when the Google prompt is dismissed', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: (notify) => notify(createPromptNotification('dismissed')),
    });

    await expect(provider.login()).rejects.toThrow(
      'Google sign-in prompt was dismissed',
    );
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when the Google prompt throws', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => {
        throw new Error('Prompt failed');
      },
    });

    await expect(provider.login()).rejects.toThrow('Prompt failed');
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when credential response is empty', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => handleCredential({}),
    });

    await expect(provider.login()).rejects.toThrow(
      'Google credential response was empty',
    );
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when credential payload is malformed', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: 'not.a-json.signature' }),
    });

    await expect(provider.login()).rejects.toThrow();
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when credential payload has no email', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    const tokenWithoutEmail = createToken({
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: tokenWithoutEmail }),
    });

    await expect(provider.login()).rejects.toThrow(
      'Google credential response had no email',
    );
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when the prompt never returns a credential', async () => {
    vi.useFakeTimers();
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({ prompt: noop });

    const login = provider.login();
    const rejectedLogin = getRejectedValue(login);
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(rejectedLogin).resolves.toEqual(
      expect.objectContaining({
        message: 'Google sign-in prompt did not return a credential',
      }),
    );
    expect(provider.isAuthenticated()).toBe(false);
  });

  it('should reject when GIS script fails to load', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    delete googleGlobal.google;

    const login = provider.login();
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    script?.dispatchEvent(new Event('error'));

    await expect(login).rejects.toThrow(
      'Failed to load Google Identity Services',
    );
  });

  it('should allow login retry after GIS script load failure', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    delete googleGlobal.google;

    const failedLogin = provider.login();
    const script = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    script?.dispatchEvent(new Event('error'));
    await expect(failedLogin).rejects.toThrow(
      'Failed to load Google Identity Services',
    );

    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: token }),
    });

    await provider.login();

    expect(provider.isAuthenticated()).toBe(true);
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

function installGoogleIdentityMock({
  prompt,
}: {
  prompt: (notify: (notification: PromptNotification) => void) => void;
}): void {
  const googleGlobal = globalThis as GoogleTestGlobal;

  googleGlobal.google = {
    accounts: {
      id: {
        initialize: vi.fn((config: InitializeConfig) => {
          googleAuthTestState.credentialCallback = config.callback;
        }),
        prompt: vi.fn(prompt),
        disableAutoSelect: vi.fn(),
      },
    },
  };
}

function handleCredential(response: CredentialResponse): void {
  if (!googleAuthTestState.credentialCallback) {
    throw new Error('Google credential callback was not initialized');
  }

  googleAuthTestState.credentialCallback(response);
}

function noop(): void {
  return;
}

async function getRejectedValue(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected promise to reject');
}

function createPromptNotification(
  moment: 'dismissed' | 'not-displayed' | 'skipped',
): PromptNotification {
  return {
    isNotDisplayed: () => moment === 'not-displayed',
    isSkippedMoment: () => moment === 'skipped',
    isDismissedMoment: () => moment === 'dismissed',
  };
}

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
