import { env } from '@/config/env';

import { AuthEvent } from './types';

import type { AuthProvider } from '@/auth/auth-provider.interface';
import type { AuthenticatedUser } from '@/auth/types';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptMomentNotification {
  isNotDisplayed(): boolean;
  isSkippedMoment(): boolean;
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

    return this.initializePromise;
  }

  async login(): Promise<void> {
    if (this.isAuthenticated()) {
      return;
    }

    await this.initialize();

    return new Promise((resolve, reject) => {
      this.pendingLogin = { resolve, reject };
      this.getGoogle()?.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          this.rejectPendingLogin(
            new Error('Google sign-in prompt was dismissed'),
          );
        }
      });
    });
  }

  logout(): void {
    this.idToken = null;
    this.authenticatedUser = null;
    this.getGoogle()?.accounts.id.disableAutoSelect();
    this.dispatch(AuthEvent.LOGOUT_SUCCESS);
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

    const payload = this.decodePayload(response.credential);
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
    this.dispatch(AuthEvent.LOGIN_SUCCESS);
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
          () => reject(new Error('Failed to load Google Identity Services')),
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
        () => reject(new Error('Failed to load Google Identity Services')),
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

  private dispatch(type: AuthEvent): void {
    globalThis.dispatchEvent(new CustomEvent(type));
  }
}
