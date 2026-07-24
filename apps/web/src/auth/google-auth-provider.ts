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
  email?: string;
  name?: string;
  exp?: number;
}

export class GoogleAuthProvider implements AuthProvider {
  private readonly clientId: string;
  private initializePromise: Promise<void> | null = null;
  private loginPromise: Promise<void> | null = null;
  private idToken: string | null = null;
  private authenticatedUser: AuthenticatedUser | null = null;
  private pendingLogin: {
    resolve: () => void;
    reject: (error: Error) => void;
  } | null = null;

  constructor(clientId: string = env.googleClientId) {
    this.clientId = clientId;
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
              new Error('Google sign-in prompt did not return a credential'),
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
                  new Error('Google sign-in prompt was dismissed'),
                );
              }
            });
          } catch (error) {
            this.rejectPendingLogin(
              error instanceof Error
                ? error
                : new Error('Google sign-in prompt failed'),
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
    this.idToken = null;
    this.authenticatedUser = null;
    this.getGoogle()?.accounts.id.disableAutoSelect();
  }

  isAuthenticated(): boolean {
    return this.idToken !== null && !this.isExpired(this.idToken);
  }

  getAuthenticatedUser(): AuthenticatedUser | null {
    return this.isAuthenticated() ? this.authenticatedUser : null;
  }

  getAccessToken(): Promise<string> {
    if (!this.idToken || this.isExpired(this.idToken)) {
      return Promise.reject(
        new Error('[GoogleAuthProvider] User is not authenticated'),
      );
    }

    return Promise.resolve(this.idToken);
  }

  private handleCredential(response: GoogleCredentialResponse): void {
    if (!response.credential) {
      this.rejectPendingLogin(
        new Error('Google credential response was empty'),
      );
      return;
    }

    let payload: GoogleIdTokenPayload;
    try {
      payload = this.decodePayload(response.credential);
    } catch (error) {
      this.rejectPendingLogin(
        error instanceof Error
          ? error
          : new Error('Google credential response was invalid'),
      );
      return;
    }

    if (!payload.email) {
      this.rejectPendingLogin(
        new Error('Google credential response had no email'),
      );
      return;
    }

    this.idToken = response.credential;
    this.authenticatedUser = {
      username: payload.email,
      name: payload.name ?? payload.email,
    };
    this.pendingLogin?.resolve();
    this.pendingLogin = null;
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
      const existingScript =
        globalThis.document.querySelector<HTMLScriptElement>(
          'script[src="https://accounts.google.com/gsi/client"]',
        );

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), {
          once: true,
        });
        existingScript.addEventListener(
          'error',
          () => {
            existingScript.remove();
            reject(new Error('Failed to load Google Identity Services'));
          },
          {
            once: true,
          },
        );
        return;
      }

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

  private rejectPendingLogin(error: Error): void {
    this.pendingLogin?.reject(error);
    this.pendingLogin = null;
  }

  private getGoogle(): GoogleIdentityGlobal | undefined {
    return (globalThis as GoogleGlobal).google;
  }
}
