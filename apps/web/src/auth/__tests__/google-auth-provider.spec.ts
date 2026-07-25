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
  const storageKey = 'wedding-planner.google-id-token';
  const googleGlobal = globalThis as GoogleTestGlobal;
  const fetchMock = vi.fn<typeof fetch>();
  let token: string;
  let validatedUser: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };

  beforeEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete googleGlobal.google;
    googleAuthTestState.credentialCallback = undefined;
    document
      .querySelector<HTMLScriptElement>(
        'script[src="https://accounts.google.com/gsi/client"]',
      )
      ?.remove();
    sessionStorage.clear();
    validatedUser = {
      id: '00000000-0000-4000-8000-000000000123',
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      avatarUrl: 'https://example.com/jane.jpg',
    };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      Response.json(validatedUser, {
        status: 200,
      }),
    );

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
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('/api/users/me', 'http://localhost:3000'),
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    expect(provider.isAuthenticated()).toBe(true);
    expect(provider.getAuthenticatedUser()).toEqual(validatedUser);
    expect(sessionStorage.getItem(storageKey)).toBe(token);
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

  it('should restore from session storage before prompting GIS', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    sessionStorage.setItem(storageKey, token);

    await provider.login();

    expect(googleGlobal.google?.accounts.id.prompt).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(provider.getAuthenticatedUser()).toEqual(validatedUser);
  });

  it('should clear rejected restore token and continue with a new prompt after 401', async () => {
    const freshToken = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    const provider = new GoogleAuthProvider('google-client-id');
    sessionStorage.setItem(storageKey, token);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        Response.json(validatedUser, {
          status: 200,
        }),
      );
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: freshToken }),
    });

    await provider.login();

    expect(googleGlobal.google?.accounts.id.prompt).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(storageKey)).toBe(freshToken);
    await expect(provider.getAccessToken()).resolves.toBe(freshToken);
  });

  it('should reject when the Google prompt is dismissed', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: (notify) => notify(createPromptNotification('dismissed')),
    });

    await expect(provider.login()).rejects.toMatchObject({
      code: 'sign_in_failed',
      message: 'Google sign-in prompt was dismissed',
    });
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

  it('should reject when validation returns forbidden and clear stored token', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: token }),
    });

    await expect(provider.login()).rejects.toMatchObject({
      code: 'forbidden',
      message: 'This Google account is not allowed for this app',
    });
    expect(provider.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
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
    await vi.waitFor(() => {
      expect(
        document.querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]',
        ),
      ).not.toBeNull();
    });
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
    await vi.waitFor(() => {
      expect(
        document.querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]',
        ),
      ).not.toBeNull();
    });
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
    expect(sessionStorage.getItem(storageKey)).toBeNull();
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
