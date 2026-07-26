import { fetchCurrentUser } from '@/api/current-user';
import { AuthError } from '@/auth/auth-error';
import { env } from '@/config/env';

import type {
  AuthChangeListener,
  AuthProvider,
} from '@/auth/auth-provider.interface';
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
  renderButton(
    parent: HTMLElement,
    options: {
      shape?: 'rectangular' | 'pill' | 'circle' | 'square';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      type?: 'standard' | 'icon';
      width?: string | number;
    },
  ): void;
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

export class GoogleAuthProvider implements AuthProvider {
  private readonly storageKey = 'wedding-planner.google-id-token';
  private readonly clientId: string;
  private readonly validateToken: (token: string) => Promise<AuthenticatedUser>;
  private readonly storage?: TokenStorage;
  private readonly now: () => number;
  private initializePromise: Promise<void> | null = null;
  private restorePromise: Promise<void> | null = null;
  private loginPromise: Promise<void> | null = null;
  private idToken: string | null = null;
  private authenticatedUser: AuthenticatedUser | null = null;
  private authError: AuthError | null = null;
  private readonly listeners = new Set<AuthChangeListener>();
  private changeScheduled = false;
  private pendingLogin: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(
    clientId: string = env.googleClientId,
    dependencies: GoogleAuthProviderDependencies = {},
  ) {
    this.clientId = clientId;
    this.validateToken = dependencies.validateToken ?? fetchCurrentUser;
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

  async restore(): Promise<void> {
    if (this.isAuthenticated()) {
      return;
    }

    this.restorePromise ??= this.restoreStoredSession();

    try {
      await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  async renderSignInButton(container: HTMLElement): Promise<() => void> {
    await this.initialize();
    const google = this.getGoogle();

    if (!google?.accounts.id) {
      throw new Error('Google Identity Services is not available');
    }

    // Render into a slot we own rather than into `container` directly: the
    // caller's effect may run twice (React StrictMode) with both calls
    // awaiting the same `initialize()` promise. A cleanup that cleared the
    // whole container would delete the *other* call's button, leaving an
    // empty sign-in area with no error.
    const slot = globalThis.document.createElement('div');
    container.append(slot);

    google.accounts.id.renderButton(slot, {
      shape: 'rectangular',
      size: 'large',
      text: 'signin_with',
      theme: 'outline',
      type: 'standard',
      width: 280,
    });

    return () => {
      slot.remove();
    };
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

  logout(error?: AuthError): void {
    this.clearAuthentication(error);
    this.getGoogle()?.accounts.id.disableAutoSelect();
  }

  isAuthenticated(): boolean {
    if (!this.idToken || !this.authenticatedUser) {
      return false;
    }

    if (this.isExpired(this.idToken)) {
      // Notify asynchronously: `isAuthenticated()` is called during render, and
      // emitting synchronously would update React state mid-render. Deferring
      // still lets consumers re-render once the token lapses, instead of
      // sitting on stale authenticated UI until something else re-renders.
      this.clearAuthentication(undefined, { notify: false });
      this.scheduleChange();
      return false;
    }

    return true;
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.isAuthenticated() ? this.authenticatedUser : null;
  }

  getAuthError(): AuthError | null {
    return this.authError;
  }

  getAccessToken(): Promise<string> {
    if (!this.isAuthenticated() || !this.idToken) {
      this.clearAuthentication(undefined, { notify: false });
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
      this.authError = null;
      this.emitChange();
      this.pendingLogin?.resolve();
      this.pendingLogin = null;
    } catch (error) {
      const authError = this.mapValidationError(error);
      this.clearAuthentication(authError);
      this.rejectPendingLogin(authError);
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
      this.authError = null;
      this.emitChange();
      return true;
    } catch (error) {
      this.clearAuthentication();

      // A rejected token is not an error state — it just means there is no
      // session, so fall through to the sign-in view rather than surfacing a
      // failure the user can do nothing about.
      if (error instanceof AuthError && error.code === 'token_rejected') {
        return false;
      }

      throw this.mapValidationError(error);
    }
  }

  private async restoreStoredSession(): Promise<void> {
    await this.restoreFromStoredToken();
  }

  private mapValidationError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    return new AuthError(
      'validation_failed',
      error instanceof Error
        ? error.message
        : 'Google credential validation failed',
    );
  }

  onChange(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private clearAuthentication(
    error?: AuthError,
    { notify = true }: { notify?: boolean } = {},
  ): void {
    this.idToken = null;
    this.authenticatedUser = null;
    this.authError = error ?? null;
    this.removeStoredToken();
    if (notify) {
      this.emitChange();
    }
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

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  private scheduleChange(): void {
    if (this.changeScheduled) {
      return;
    }

    this.changeScheduled = true;
    globalThis.setTimeout(() => {
      this.changeScheduled = false;
      this.emitChange();
    }, 0);
  }
}
