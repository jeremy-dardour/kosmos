import type { AuthState } from '@/auth/auth-state';
import type { ComponentType } from 'react';

export type AuthChangeListener = () => void;

/**
 * The app's authenticated-session lifecycle. It restores and exposes the
 * current session, supplies its bearer token, and ends it. One instance exists
 * for the lifetime of the app.
 *
 * It outlives individual sessions and reports `anonymous` between them.
 * Identity acquisition belongs to `AuthSystem.SignInButton` because some
 * providers, including Google, require provider-owned UI rather than an
 * imperative sign-in command.
 *
 * `getState()` must return a stable reference until the state actually changes:
 * it feeds `useSyncExternalStore`, which loops if handed a fresh object.
 *
 * How this composes into the complete auth module: ADR 0007.
 */
export interface AuthSession {
  getState(): AuthState;
  subscribe(listener: AuthChangeListener): () => void;
  signOut(): void;
  getAccessToken(): Promise<string>;
}

/** The complete auth module: session lifecycle plus identity acquisition UI. */
export interface AuthSystem {
  session: AuthSession;
  SignInButton: ComponentType;
}
