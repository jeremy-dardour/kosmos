import { fetchCurrentUser } from '@/api/current-user';
import { AuthError } from '@/auth/auth-error';
import { ANONYMOUS, RESTORING } from '@/auth/auth-state';
import { env } from '@/config/env';

import type {
  AuthChangeListener,
  AuthSession,
} from '@/auth/auth-session.interface';
import type { AuthState } from '@/auth/auth-state';

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

const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const ID_TOKEN_STORAGE_KEY = 'wedding-planner.google-id-token';
const SIGN_IN_PROMPT_TIMEOUT_MS = 60_000;

const SIGN_IN_BUTTON_OPTIONS = {
  shape: 'rectangular',
  size: 'large',
  text: 'signin_with',
  theme: 'outline',
  type: 'standard',
  width: 280,
} as const;

export class GoogleAuthProvider implements AuthSession {
  private readonly clientId: string;
  private state: AuthState = RESTORING;
  private readonly restorePromise: Promise<void>;
  private initializePromise: Promise<void> | null = null;
  private signInPromise: Promise<void> | null = null;
  private idToken: string | null = null;
  private expiryTimeout: ReturnType<typeof globalThis.setTimeout> | undefined;
  private readonly listeners = new Set<AuthChangeListener>();
  private pendingSignIn: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(clientId: string = env.googleClientId) {
    this.clientId = clientId;
    this.restorePromise = this.restoreStoredSession();
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  signIn(): Promise<void> {
    if (this.state.status === 'authenticated') {
      return Promise.resolve();
    }

    this.signInPromise ??= this.startSignIn();

    return this.signInPromise;
  }

  signOut(): void {
    this.clearSession(ANONYMOUS);
    this.getGoogle()?.accounts.id.disableAutoSelect();
  }

  getAccessToken(): Promise<string> {
    if (this.state.status !== 'authenticated' || !this.idToken) {
      return Promise.reject(
        new Error('[GoogleAuthProvider] User is not authenticated'),
      );
    }

    return Promise.resolve(this.idToken);
  }

  /**
   * Appends a slot rather than rendering into `container` directly: the
   * caller's effect runs twice under React StrictMode, and a cleanup that
   * cleared the whole container would delete the *other* call's button,
   * leaving an empty sign-in area with no error.
   */
  async renderSignInButton(container: HTMLElement): Promise<() => void> {
    await this.initialize();
    const google = this.getGoogle();

    if (!google?.accounts.id) {
      throw new Error('Google Identity Services is not available');
    }

    const slot = globalThis.document.createElement('div');
    container.append(slot);
    google.accounts.id.renderButton(slot, SIGN_IN_BUTTON_OPTIONS);

    return () => {
      slot.remove();
    };
  }

  private async initialize(): Promise<void> {
    this.initializePromise ??= this.initializeGoogleIdentity();

    try {
      await this.initializePromise;
    } catch (error) {
      this.initializePromise = null;
      throw error;
    }
  }

  private async startSignIn(): Promise<void> {
    try {
      await this.restorePromise;
      if (this.state.status === 'authenticated') {
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
            this.rejectPendingSignIn(
              new AuthError(
                'sign_in_failed',
                'Google sign-in prompt did not return a credential',
              ),
            );
          }, SIGN_IN_PROMPT_TIMEOUT_MS);

          this.pendingSignIn = { resolve, reject };

          try {
            google.accounts.id.prompt((notification) => {
              if (
                notification.isNotDisplayed() ||
                notification.isSkippedMoment() ||
                notification.isDismissedMoment()
              ) {
                this.rejectPendingSignIn(
                  new AuthError(
                    'sign_in_failed',
                    'Google sign-in prompt was dismissed',
                  ),
                );
              }
            });
          } catch (error) {
            this.rejectPendingSignIn(
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
      this.signInPromise = null;
    }
  }

  private handleCredential(response: GoogleCredentialResponse): void {
    void this.completeCredentialSignIn(response);
  }

  private async completeCredentialSignIn(
    response: GoogleCredentialResponse,
  ): Promise<void> {
    if (!response.credential) {
      this.rejectPendingSignIn(
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
      const authError = this.toAuthError(
        error,
        'Google credential response was invalid',
      );
      this.clearSession(this.stateForError(authError));
      this.rejectPendingSignIn(authError);
      return;
    }

    await this.adoptToken(response.credential, { persist: true });

    if (this.state.status === 'authenticated') {
      this.pendingSignIn?.resolve();
      this.pendingSignIn = null;
      return;
    }

    this.rejectPendingSignIn(
      this.state.status === 'forbidden' || this.state.status === 'error'
        ? this.state.error
        : new AuthError('validation_failed', 'Google sign-in did not complete'),
    );
  }

  private async restoreStoredSession(): Promise<void> {
    const storedToken = this.readStoredToken();
    if (!storedToken) {
      this.setState(ANONYMOUS);
      return;
    }

    try {
      if (this.isExpired(storedToken)) {
        this.clearSession(ANONYMOUS);
        return;
      }
    } catch {
      this.clearSession(ANONYMOUS);
      return;
    }

    await this.adoptToken(storedToken, { persist: false });
  }

  /**
   * A rejected token settles on `anonymous`, not `error`: it means there is no
   * session, which calls for a sign-in prompt rather than a failure the user
   * can do nothing about.
   */
  private async adoptToken(
    token: string,
    { persist }: { persist: boolean },
  ): Promise<void> {
    this.idToken = token;
    if (persist) {
      this.writeStoredToken(token);
    }

    try {
      const user = await fetchCurrentUser(token);
      this.scheduleExpiry(token);
      this.setState({ status: 'authenticated', user });
    } catch (error) {
      const authError = this.toAuthError(
        error,
        'Google credential validation failed',
      );
      this.clearSession(this.stateForError(authError));
    }
  }

  private stateForError(error: AuthError): AuthState {
    if (error.code === 'forbidden') {
      return { status: 'forbidden', error };
    }

    if (error.code === 'token_rejected' || error.code === 'sign_in_failed') {
      return ANONYMOUS;
    }

    return { status: 'error', error };
  }

  private toAuthError(error: unknown, fallbackMessage: string): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    return new AuthError(
      'validation_failed',
      error instanceof Error ? error.message : fallbackMessage,
    );
  }

  private scheduleExpiry(token: string): void {
    this.clearExpiryTimeout();

    let payload: GoogleIdTokenPayload;
    try {
      payload = this.decodePayload(token);
    } catch {
      return;
    }

    if (!payload.exp) {
      return;
    }

    const remaining = payload.exp * 1000 - Date.now();
    this.expiryTimeout = globalThis.setTimeout(
      () => {
        this.clearSession(ANONYMOUS);
      },
      Math.max(remaining, 0),
    );
  }

  private clearExpiryTimeout(): void {
    if (!this.expiryTimeout) {
      return;
    }

    globalThis.clearTimeout(this.expiryTimeout);
    this.expiryTimeout = undefined;
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

    // A tag already in the document is still loading — GSI publishes the global
    // before `load` fires, so the check above would have returned otherwise.
    // Await that load; removing and re-adding the tag restarts the download and
    // races two copies of the script.
    const pending = [...globalThis.document.querySelectorAll('script')].find(
      (script) => script.src === GSI_SCRIPT_URL,
    );

    await new Promise<void>((resolve, reject) => {
      const script = pending ?? this.appendScript();

      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener(
        'error',
        () => {
          script.remove();
          reject(new Error('Failed to load Google Identity Services'));
        },
        { once: true },
      );
    });
  }

  private appendScript(): HTMLScriptElement {
    const script = globalThis.document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    globalThis.document.head.append(script);

    return script;
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

    return payload.exp * 1000 <= Date.now();
  }

  private base64UrlDecode(value: string): string {
    const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );

    return atob(padded);
  }

  private rejectPendingSignIn(error: Error): void {
    this.pendingSignIn?.reject(error);
    this.pendingSignIn = null;
  }

  private clearSession(next: AuthState): void {
    this.idToken = null;
    this.clearExpiryTimeout();
    this.removeStoredToken();
    this.setState(next);
  }

  private setState(next: AuthState): void {
    if (this.state === next) {
      return;
    }

    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private readStoredToken(): string | null {
    try {
      return this.getStorage()?.getItem(ID_TOKEN_STORAGE_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private writeStoredToken(token: string): void {
    try {
      this.getStorage()?.setItem(ID_TOKEN_STORAGE_KEY, token);
    } catch {
      return;
    }
  }

  private removeStoredToken(): void {
    try {
      this.getStorage()?.removeItem(ID_TOKEN_STORAGE_KEY);
    } catch {
      return;
    }
  }

  private getStorage(): Storage | undefined {
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
