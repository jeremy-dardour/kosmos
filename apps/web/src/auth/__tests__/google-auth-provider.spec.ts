import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleAuthProvider } from '@/auth/google-auth-provider';

type GoogleTestGlobal = typeof globalThis & {
  google?: {
    accounts: {
      id: {
        initialize: ReturnType<typeof vi.fn>;
        renderButton: ReturnType<typeof vi.fn>;
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

const googleAuthTestState: {
  credentialCallback?: (response: CredentialResponse) => void;
} = {};

describe('googleAuthProvider', () => {
  const storageKey = 'kosmos.google-id-token';
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
    fetchMock.mockResolvedValue(Response.json(validatedUser, { status: 200 }));

    token = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    installGoogleIdentityMock();
  });

  it('should authenticate from the rendered button credential callback', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    const container = document.createElement('div');

    await provider.renderSignInButton(container);
    handleCredential({ credential: token });
    await waitForState(provider, 'authenticated');

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
    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: validatedUser,
    });
    expect(sessionStorage.getItem(storageKey)).toBe(token);
    await expect(provider.getAccessToken()).resolves.toBe(token);
  });

  it('should restore a stored session on construction without loading GIS', async () => {
    sessionStorage.setItem(storageKey, token);

    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

    expect(googleGlobal.google?.accounts.id.initialize).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: validatedUser,
    });
  });

  it('should settle on anonymous when there is no stored token', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);

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

  it('should render the official Google sign-in button', async () => {
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
  });

  it('should leave a concurrent sign-in button intact when a stale cleanup runs', async () => {
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

  it('should recover from a rejected restored token through the rendered button', async () => {
    const freshToken = createToken({
      email: 'jane.doe@example.com',
      name: 'Jane Doe',
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    sessionStorage.setItem(storageKey, token);
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(Response.json(validatedUser, { status: 200 }));

    const provider = new GoogleAuthProvider('google-client-id');
    await settle(provider);
    expect(provider.getState()).toEqual({ status: 'anonymous' });

    await provider.renderSignInButton(document.createElement('div'));
    handleCredential({ credential: freshToken });
    await waitForState(provider, 'authenticated');

    expect(sessionStorage.getItem(storageKey)).toBe(freshToken);
    await expect(provider.getAccessToken()).resolves.toBe(freshToken);
  });

  it('should remain anonymous when the credential response is empty', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.renderSignInButton(document.createElement('div'));

    handleCredential({});

    expect(provider.getState()).toEqual({ status: 'anonymous' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should enter error state for a malformed credential payload', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.renderSignInButton(document.createElement('div'));

    handleCredential({ credential: 'not.a-json.signature' });

    expect(provider.getState()).toMatchObject({ status: 'error' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should enter forbidden state and clear a rejected credential', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }));
    await provider.renderSignInButton(document.createElement('div'));

    handleCredential({ credential: token });
    await waitForState(provider, 'forbidden');

    expect(provider.getState()).toMatchObject({
      status: 'forbidden',
      error: {
        code: 'forbidden',
        message: 'This Google account is not allowed for this app',
      },
    });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
  });

  it('should reject when the GIS script fails to load', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    delete googleGlobal.google;

    const rendering = provider.renderSignInButton(
      document.createElement('div'),
    );
    const script = await findGsiScript();
    script.dispatchEvent(new Event('error'));

    await expect(rendering).rejects.toThrow(
      'Failed to load Google Identity Services',
    );
  });

  it('should allow rendering retry after a GIS script load failure', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    const container = document.createElement('div');
    delete googleGlobal.google;

    const failedRendering = provider.renderSignInButton(container);
    const script = await findGsiScript();
    script.dispatchEvent(new Event('error'));
    await expect(failedRendering).rejects.toThrow(
      'Failed to load Google Identity Services',
    );

    installGoogleIdentityMock();
    await provider.renderSignInButton(container);

    expect(container.children).toHaveLength(1);
  });

  it('should await a GIS script already in flight instead of replacing it', async () => {
    delete googleGlobal.google;
    const pending = document.createElement('script');
    pending.src = 'https://accounts.google.com/gsi/client';
    document.head.append(pending);

    const provider = new GoogleAuthProvider('google-client-id');
    const rendering = provider.renderSignInButton(
      document.createElement('div'),
    );

    expect(
      document.querySelectorAll(
        'script[src="https://accounts.google.com/gsi/client"]',
      ),
    ).toHaveLength(1);
    installGoogleIdentityMock();
    pending.dispatchEvent(new Event('load'));

    await rendering;
    expect(document.head.contains(pending)).toBe(true);
  });

  it('should clear local state on logout', async () => {
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.renderSignInButton(document.createElement('div'));
    handleCredential({ credential: token });
    await waitForState(provider, 'authenticated');

    provider.signOut();

    expect(provider.getState()).toEqual({ status: 'anonymous' });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(
      googleGlobal.google?.accounts.id.disableAutoSelect,
    ).toHaveBeenCalledOnce();
  });

  it('should ignore validation that finishes after logout', async () => {
    const validation = deferred<Response>();
    fetchMock.mockReturnValueOnce(validation.promise);
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.renderSignInButton(document.createElement('div'));

    handleCredential({ credential: token });
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    provider.signOut();
    validation.resolve(Response.json(validatedUser, { status: 200 }));
    await flushAsyncWork();

    expect(provider.getState()).toEqual({ status: 'anonymous' });
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    await expect(provider.getAccessToken()).rejects.toThrow(
      'User is not authenticated',
    );
  });

  it('should ignore an older validation after a newer credential wins', async () => {
    const firstValidation = deferred<Response>();
    const secondValidation = deferred<Response>();
    const newerToken = createToken({
      exp: Math.floor(Date.now() / 1000) + 7200,
    });
    const newerUser = {
      ...validatedUser,
      id: '00000000-0000-4000-8000-000000000456',
      email: 'newer@example.com',
    };
    fetchMock
      .mockReturnValueOnce(firstValidation.promise)
      .mockReturnValueOnce(secondValidation.promise);
    const provider = new GoogleAuthProvider('google-client-id');
    await provider.renderSignInButton(document.createElement('div'));

    handleCredential({ credential: token });
    handleCredential({ credential: newerToken });
    secondValidation.resolve(Response.json(newerUser, { status: 200 }));
    await waitForState(provider, 'authenticated');
    firstValidation.resolve(Response.json(validatedUser, { status: 200 }));
    await flushAsyncWork();

    expect(provider.getState()).toEqual({
      status: 'authenticated',
      user: newerUser,
    });
    expect(sessionStorage.getItem(storageKey)).toBe(newerToken);
  });
});

function installGoogleIdentityMock(): void {
  const googleGlobal = globalThis as GoogleTestGlobal;

  googleGlobal.google = {
    accounts: {
      id: {
        initialize: vi.fn((config: InitializeConfig) => {
          googleAuthTestState.credentialCallback = config.callback;
        }),
        renderButton: vi.fn(),
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

async function settle(provider: GoogleAuthProvider): Promise<void> {
  await vi.waitFor(() => {
    expect(provider.getState().status).not.toBe('restoring');
  });
}

async function waitForState(
  provider: GoogleAuthProvider,
  status: 'authenticated' | 'forbidden',
): Promise<void> {
  await vi.waitFor(() => {
    expect(provider.getState().status).toBe(status);
  });
}

async function findGsiScript(): Promise<HTMLScriptElement> {
  let script: HTMLScriptElement | null = null;
  await vi.waitFor(() => {
    script = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    expect(script).not.toBeNull();
  });

  return script!;
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  const { promise, resolve } = Promise.withResolvers<T>();

  return { promise, resolve };
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
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
