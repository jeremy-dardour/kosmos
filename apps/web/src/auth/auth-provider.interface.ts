import type { AuthError } from '@/auth/auth-error';
import type { AuthState } from '@/auth/auth-state';

export type AuthChangeListener = () => void;

/**
 * A session state machine: what the session is, and the two ways to change it.
 *
 * - `getState()` must return a stable reference until the state actually
 *   changes — it feeds `useSyncExternalStore`, which loops if handed a fresh
 *   object per call.
 * - Rendering a sign-in affordance is deliberately absent. It is provider
 *   specific (Google renders its own iframe button, a fake needs no widget at
 *   all), so it ships as a component beside the provider — see
 *   `createAuth()`. Keeping it here forced every adapter to implement a DOM
 *   method and put an `HTMLElement` in an otherwise DOM-free interface.
 */
export interface AuthProvider {
  getState(): AuthState;
  subscribe(listener: AuthChangeListener): () => void;
  signIn(): Promise<void>;
  signOut(reason?: AuthError): void;
  getAccessToken(): Promise<string>;
}
