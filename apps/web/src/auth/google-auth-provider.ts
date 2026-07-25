import { AuthError } from '@/auth/auth-error';
import { env } from '@/config/env';

import type { AuthProvider } from '@/auth/auth-provider.interface';
import type { AuthenticatedUser } from '@/auth/types';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
  isDismissedMoment(): boolean;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  prompt(
    callback?: (notification: GooglePromptMomentNotification) => void,
  ): void;
  disableAutoSelect(): void;
}

interface GoogleIdentityGlobal {
  accounts: {
    id: GoogleAccountsId;
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityGlobal;
  }
}

type GoogleGlobal = typeof globalThis & {
  google?: GoogleIdentityGlobal;
};

interface GoogleIdTokenPayload {
  exp?: number;
}

interface TokenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface GoogleAuthProviderDependencies {
  validateToken?: (token: string) => Promise<AuthenticatedUser>;
  storage?: TokenStorage;
  now?: () => number;
}

class CurrentUserRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CurrentUserRequestError';
  }
}

export class GoogleAuthProvider implements AuthProvider {
  private readonly storageKey = 'wedding-planner.google-id-token';
  private readonly clientId: string;
  private readonly validateToken: (token: string) => Promise<AuthenticatedUser>;
  private readonly storage?: TokenStorage;
  private readonly now: () => number;
  private initializePromise: Promise<void> | null = null;
  private loginPromise: Promise<void> | null = null;
  private idToken: string | null = null;
  private authenticatedUser: AuthenticatedUser | null = null;
  private pendingLogin: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(
    clientId: string = env.googleClientId,
    dependencies: GoogleAuthProviderDependencies = {},
  ) {
    this.clientId = clientId;
    this.validateToken =
      dependencies.validateToken ??
      ((token) => this.fetchCurrentUserFromApi(token));
    this.storage = dependencies.storage;
    this.now = dependencies.now ?? (() => Date.now());
  }

  async initialize(): Promise<void> {
    this.initializePromise ??= this.initializeGoogleIdentity();

    try {
      await this.initializePromise;
    } catch (error) {
      this.initializePromise = null;
      throw error;
    }
  }

  login(): Promise<void> {
    if (this.isAuthenticated()) {
      return Promise.resolve();
    }

    this.loginPromise ??= this.startLogin();

    return this.loginPromise;
  }

  private async startLogin(): Promise<void> {
    try {
      const wasRestored = await this.restoreFromStoredToken();
      if (wasRestored) {
        return;
      }

      await this.initialize();
      const google = this.getGoogle();

      if (!google?.accounts.id) {
        throw new Error('Google Identity Services is not available');
      }

      let timeout: ReturnType<typeof globalThis.setTimeout> | undefined;
      try {
        await new Promise<void>((resolve, reject) => {
          timeout = globalThis.setTimeout(() => {
            this.rejectPendingLogin(
              new AuthError(
                'sign_in_failed',
                'Google sign-in prompt did not return a credential',
              ),
            );
          }, 60_000);

          this.pendingLogin = { resolve, reject };

          try {
            google.accounts.id.prompt((notification) => {
              if (
                notification.isNotDisplayed() ||
                notification.isSkippedMoment() ||
                notification.isDismissedMoment()
              ) {
                this.rejectPendingLogin(
                  new AuthError(
                    'sign_in_failed',
                    'Google sign-in prompt was dismissed',
                  ),
                );
              }
            });
          } catch (error) {
            this.rejectPendingLogin(
              error instanceof Error
                ? new AuthError('sign_in_failed', error.message)
                : new AuthError(
                    'sign_in_failed',
                    'Google sign-in prompt failed',
                  ),
            );
          }
        });
      } finally {
        if (timeout) {
          globalThis.clearTimeout(timeout);
        }
      }
    } finally {
      this.loginPromise = null;
    }
  }

  logout(): void {
    this.clearAuthentication();
    this.getGoogle()?.accounts.id.disableAutoSelect();
  }

  isAuthenticated(): boolean {
    if (!this.idToken || !this.authenticatedUser) {
      return false;
    }

    if (this.isExpired(this.idToken)) {
      this.clearAuthentication();
      return false;
    }

    return true;
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.isAuthenticated() ? this.authenticatedUser : null;
  }

  getAccessToken(): Promise<string> {
    if (!this.isAuthenticated() || !this.idToken) {
      this.clearAuthentication();
      return Promise.reject(
        new Error('[GoogleAuthProvider] User is not authenticated'),
      );
    }

    return Promise.resolve(this.idToken);
  }

  private handleCredential(response: GoogleCredentialResponse): void {
    void this.completeCredentialLogin(response);
  }

  private async completeCredentialLogin(
    response: GoogleCredentialResponse,
  ): Promise<void> {
    if (!response.credential) {
      this.rejectPendingLogin(
        new Error('Google credential response was empty'),
      );
      return;
    }

    try {
      if (this.isExpired(response.credential)) {
        throw new AuthError(
          'sign_in_failed',
          'Google credential response was expired',
        );
      }
    } catch (error) {
      this.clearAuthentication();
      this.rejectPendingLogin(
        error instanceof AuthError || error instanceof Error
          ? error
          : new Error('Google credential response was invalid'),
      );
      return;
    }

    this.idToken = response.credential;
    this.writeStoredToken(response.credential);

    try {
      this.authenticatedUser = await this.validateToken(response.credential);
      this.pendingLogin?.resolve();
      this.pendingLogin = null;
    } catch (error) {
      this.clearAuthentication();
      this.rejectPendingLogin(this.mapValidationError(error));
    }
  }

  private async initializeGoogleIdentity(): Promise<void> {
    await this.loadScript();
    this.getGoogle()?.accounts.id.initialize({
      client_id: this.clientId,
      callback: (response) => this.handleCredential(response),
    });
  }

  private async loadScript(): Promise<void> {
    if (this.getGoogle()?.accounts.id) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      globalThis.document
        .querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]',
        )
        ?.remove();

      const script = globalThis.document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener(
        'error',
        () => {
          script.remove();
          reject(new Error('Failed to load Google Identity Services'));
        },
        { once: true },
      );
      globalThis.document.head.append(script);
    });
  }

  private decodePayload(token: string): GoogleIdTokenPayload {
    const [, payload] = token.split('.');
    if (!payload) {
      throw new Error('Google ID token payload is missing');
    }

    return JSON.parse(this.base64UrlDecode(payload)) as GoogleIdTokenPayload;
  }

  private isExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload.exp) {
      return true;
    }

    return payload.exp * 1000 <= this.now();
  }

  private base64UrlDecode(value: string): string {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    return atob(padded);
  }

  private rejectPendingLogin(error: Error): void {
    this.pendingLogin?.reject(error);
    this.pendingLogin = null;
  }

  private async restoreFromStoredToken(): Promise<boolean> {
    const storedToken = this.readStoredToken();
    if (!storedToken) {
      return false;
    }

    try {
      if (this.isExpired(storedToken)) {
        this.clearAuthentication();
        return false;
      }
    } catch {
      this.clearAuthentication();
      return false;
    }

    this.idToken = storedToken;

    try {
      this.authenticatedUser = await this.validateToken(storedToken);
      return true;
    } catch (error) {
      this.clearAuthentication();

      if (error instanceof CurrentUserRequestError && error.status === 401) {
        return false;
      }

      throw this.mapValidationError(error);
    }
  }

  private async fetchCurrentUserFromApi(
    token: string,
  ): Promise<AuthenticatedUser> {
    const response = await fetch(new URL('/api/users/me', env.apiUrl), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) {
      return (await response.json()) as AuthenticatedUser;
    }

    throw new CurrentUserRequestError(
      response.status,
      `Current user validation failed with status ${response.status}`,
    );
  }

  private mapValidationError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof CurrentUserRequestError && error.status === 403) {
      return new AuthError(
        'forbidden',
        'This Google account is not allowed for this app',
      );
    }

    if (error instanceof CurrentUserRequestError && error.status === 401) {
      return new AuthError(
        'validation_failed',
        'Google credential validation failed',
      );
    }

    return new AuthError(
      'validation_failed',
      error instanceof Error
        ? error.message
        : 'Google credential validation failed',
    );
  }

  private clearAuthentication(): void {
    this.idToken = null;
    this.authenticatedUser = null;
    this.removeStoredToken();
  }

  private readStoredToken(): string | null {
    try {
      return this.getStorage()?.getItem(this.storageKey) ?? null;
    } catch {
      return null;
    }
  }

  private writeStoredToken(token: string): void {
    try {
      this.getStorage()?.setItem(this.storageKey, token);
    } catch {
      return;
    }
  }

  private removeStoredToken(): void {
    try {
      this.getStorage()?.removeItem(this.storageKey);
    } catch {
      return;
    }
  }

  private getStorage(): TokenStorage | undefined {
    if (this.storage) {
      return this.storage;
    }

    try {
      return globalThis.sessionStorage;
    } catch {
      return undefined;
    }
  }

  private getGoogle(): GoogleIdentityGlobal | undefined {
    return (globalThis as GoogleGlobal).google;
  }
}
