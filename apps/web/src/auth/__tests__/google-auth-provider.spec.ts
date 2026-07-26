import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleAuthProvider } from '@/auth/google-auth-provider';

type GoogleTestGlobal = typeof globalThis & {
  google?: {
    accounts: {
      id: {
        initialize: ReturnType<typeof vi.fn>;
        renderButton: ReturnType<typeof vi.fn>;
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

    await provider.signIn();

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
    expect(provider.getState().status).toBe('authenticated');
    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: validatedUser,
    });
    expect(sessionStorage.getItem(storageKey)).toBe(token);
    await expect(provider.getAccessToken()).resolves.toBe(token);
  });

  it('should reuse the pending login promise for concurrent login calls', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({ prompt: noop });

    const firstLogin = provider.signIn();
    const secondLogin = provider.signIn();

    expect(secondLogin).toBe(firstLogin);
    await vi.waitFor(() => {
      expect(googleGlobal.google?.accounts.id.prompt).toHaveBeenCalledOnce();
    });

    handleCredential({ credential: token });
    await expect(firstLogin).resolves.toBeUndefined();
    await expect(secondLogin).resolves.toBeUndefined();
  });

  it('should restore a stored session on construction without prompting GIS', async () => {
    sessionStorage.setItem(storageKey, token);

    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

    expect(googleGlobal.google?.accounts.id.prompt).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: validatedUser,
    });
  });

  it('should settle on anonymous when there is no stored token', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

    expect(googleGlobal.google?.accounts.id.prompt).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(provider.getState()).toEqual({ status: 'anonymous' });
  });

  it('should notify subscribers when the session settles', async () => {
    sessionStorage.setItem(storageKey, token);
    const provider = new GoogleAuthProvider('google-client-id');
    const listener = vi.fn();
    provider.subscribe(listener);

    await settle(provider);

    expect(listener).toHaveBeenCalled();
  });

  it('should return a stable state reference until the session changes', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

    expect(provider.getState()).toBe(provider.getState());
  });

  it('should render the Google sign-in button for interactive login', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    const container = document.createElement('div');

    await provider.renderSignInButton(container);

    expect(googleGlobal.google?.accounts.id.renderButton).toHaveBeenCalledWith(
      container.firstElementChild,
      expect.objectContaining({
        text: 'signin_with',
        type: 'standard',
      }),
    );
    expect(container.children).toHaveLength(1);
    expect(googleGlobal.google?.accounts.id.prompt).not.toHaveBeenCalled();
  });

  it('should leave a concurrent sign-in button intact when a stale cleanup runs', async () => {
    // React StrictMode runs the caller's effect twice, so two renders can be
    // in flight against the same container. The first call's cleanup must
    // remove only its own button, not whichever one is currently live.
    const provider = new GoogleAuthProvider('google-client-id');
    const container = document.createElement('div');

    const [cleanupFirst] = await Promise.all([
      provider.renderSignInButton(container),
      provider.renderSignInButton(container),
    ]);

    expect(container.children).toHaveLength(2);

    cleanupFirst();

    expect(container.children).toHaveLength(1);
  });

  it('should clear rejected restore token and continue with a new prompt after 401', async () => {
    const freshToken = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
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

    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

    // A 401 on the stored token is not an error state — it just means there is
    // no session, so the provider settles on anonymous and a prompt can follow.
    expect(provider.getState()).toEqual({ status: 'anonymous' });

    await provider.signIn();

    expect(googleGlobal.google?.accounts.id.prompt).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(storageKey)).toBe(freshToken);
    await expect(provider.getAccessToken()).resolves.toBe(freshToken);
  });

  it('should reject when the Google prompt is dismissed', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: (notify) => notify(createPromptNotification('dismissed')),
    });

    await expect(provider.signIn()).rejects.toMatchObject({
      code: 'sign_in_failed',
      message: 'Google sign-in prompt was dismissed',
    });
    expect(provider.getState().status).not.toBe('authenticated');
  });

  it('should reject when the Google prompt throws', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => {
        throw new Error('Prompt failed');
      },
    });

    await expect(provider.signIn()).rejects.toThrow('Prompt failed');
    expect(provider.getState().status).not.toBe('authenticated');
  });

  it('should reject when credential response is empty', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => handleCredential({}),
    });

    await expect(provider.signIn()).rejects.toThrow(
      'Google credential response was empty',
    );
    expect(provider.getState().status).not.toBe('authenticated');
  });

  it('should reject when credential payload is malformed', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: 'not.a-json.signature' }),
    });

    await expect(provider.signIn()).rejects.toThrow();
    expect(provider.getState().status).not.toBe('authenticated');
  });

  it('should reject when validation returns forbidden and clear stored token', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    installGoogleIdentityMock({
      prompt: () => handleCredential({ credential: token }),
    });

    await expect(provider.signIn()).rejects.toMatchObject({
      code: 'forbidden',
      message: 'This Google account is not allowed for this app',
    });
    expect(provider.getState()).toMatchObject({ status: 'forbidden' });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('should reject when the prompt never returns a credential', async () => {
    vi.useFakeTimers();
    const provider = new GoogleAuthProvider('google-client-id');
    installGoogleIdentityMock({ prompt: noop });

    const login = provider.signIn();
    const rejectedLogin = getRejectedValue(login);
    await vi.advanceTimersByTimeAsync(60_000);

    await expect(rejectedLogin).resolves.toEqual(
      expect.objectContaining({
        message: 'Google sign-in prompt did not return a credential',
      }),
    );
    expect(provider.getState().status).not.toBe('authenticated');
  });

  it('should reject when GIS script fails to load', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    delete googleGlobal.google;

    const login = provider.signIn();
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

    const failedLogin = provider.signIn();
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

    await provider.signIn();

    expect(provider.getState().status).toBe('authenticated');
  });

  it('should clear local state on logout', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.signIn();

    provider.signOut();

    expect(provider.getState().status).not.toBe('authenticated');
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
        renderButton: vi.fn(),
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

/** Waits for the constructor's restore to leave the initial `restoring` state. */
async function settle(provider: GoogleAuthProvider): Promise<void> {
  await vi.waitFor(() => {
    expect(provider.getState().status).not.toBe('restoring');
  });
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
