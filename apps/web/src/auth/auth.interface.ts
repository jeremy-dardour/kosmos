import type { AuthState } from '@/auth/auth-state';

export type AuthChangeListener = () => void;

/**
 * The app's auth state machine: owns identity acquisition, the session it
 * yields, and the bearer token every API call carries. One instance exists for
 * the lifetime of the app.
 *
 * It is not itself a session — it outlives every session and reports
 * `anonymous` between them. Implementations are named `…AuthProvider` because
 * each adapts one identity provider.
 *
 * `getState()` must return a stable reference until the state actually changes:
 * it feeds `useSyncExternalStore`, which loops if handed a fresh object.
 *
 * What this interface leaves out, and why: ADR 0007.
 */
export interface Auth {
  getState(): AuthState;
  subscribe(listener: AuthChangeListener): () => void;
  signIn(): Promise<void>;
  signOut(): void;
  getAccessToken(): Promise<string>;
}
