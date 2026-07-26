import type { AuthState } from '@/auth/auth-state';

export type AuthChangeListener = () => void;

/**
 * `getState()` must return a stable reference until the state actually changes:
 * it feeds `useSyncExternalStore`, which loops if handed a fresh object.
 *
 * What this interface leaves out, and why: ADR 0007.
 */
export interface AuthSession {
  getState(): AuthState;
  subscribe(listener: AuthChangeListener): () => void;
  signIn(): Promise<void>;
  signOut(): void;
  getAccessToken(): Promise<string>;
}
