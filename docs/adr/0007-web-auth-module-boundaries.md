# ADR 0007: Web auth module boundaries

**Status:** Accepted — 2026-07, amended 2026-07-27

Supersedes the frontend-flow details in
[V1 Tech Design § Auth](../specs/v1-tech-design.md#auth), which described
imperative Google login as the entry point used by `ProtectedRoute`.

## Decision

Four seams define the web auth module.

### 1. `AuthSystem` is the complete auth module

Authentication has two capabilities with different shapes:

```ts
interface AuthSystem {
  session: AuthSession;
  SignInButton: React.ComponentType;
}

interface AuthSession {
  getState(): AuthState;
  subscribe(listener): () => void;
  signOut(): void;
  getAccessToken(): Promise<string>;
}
```

`AuthSession` owns the authenticated-session lifecycle: restoration, observable
state, bearer-token access, expiry, and logout. The object outlives individual
sessions and reports `anonymous` between them.

`SignInButton` owns identity acquisition. This is UI because Google Identity
Services (GIS) requires a provider-rendered button for its reliable interactive
flow; it cannot be represented honestly as an imperative `signIn()` method.

`createAuthSystem()` composes one session adapter with its matching bound
sign-in component. `AuthContext` carries this stable system. `useAuth()` returns
the session for state-independent actions, `useAuthState()` subscribes through
`useSyncExternalStore`, and the shared `<SignInButton />` delegates to
`AuthSystem.SignInButton`. No consumer branches on a concrete provider.

`getState()` must return a stable reference until state changes because
`useSyncExternalStore` loops when given a fresh snapshot on every read.

### 2. Google uses the rendered button only

The Google adapter loads GIS, calls `initialize`, and renders the official
button with `renderButton`. Its credential callback validates the returned ID
token and updates `AuthSession`.

Google One Tap (`google.accounts.id.prompt`) is not used. Browser and FedCM
prompt lifecycle notifications do not form a reliable promise: prompt
dismissal can also mean a credential was returned, callbacks can arrive after
application timeouts, and the prompt may be suppressed. Maintaining a second
One Tap acquisition path added state and races without improving the normal
flow.

`GoogleAuthProvider.renderSignInButton` renders into a node it creates and
cleans up only that node. React StrictMode can run concurrent effects, so
clearing the caller's container could delete the live button created by another
effect.

Loading GIS follows the inverse rule: an existing script tag is awaited rather
than replaced. Replacing it restarts the download and races two script copies.
After a load failure, the failed tag and cached initialization promise are
cleared so the rendered button can retry.

### 3. Token acquisition and app-session validation are separate

GIS proves that Google issued a credential; it does not decide who the user is
inside this application. `apps/web/src/api/current-user.ts` owns:

```ts
fetchCurrentUser(token): Promise<CurrentUser>
```

It is the only web module that knows about `GET /api/users/me` and maps its HTTP
responses to `AuthError` codes. `CurrentUser` comes from generated OpenAPI
types, so contract drift is a type error.

It deliberately uses `fetch` rather than the shared API client. Validation runs
before an app session exists, while the shared client's auth middleware signs
out on `401`, which is the response this call exists to interpret.

A credential is persisted and exposed only after `/users/me` succeeds. Each
validation captures an operation generation. A newer credential, logout, token
expiry, or validation failure advances that generation, so stale asynchronous
results cannot authenticate or clear a newer session.

Session recovery starts on provider construction. The state begins as
`restoring`, reads the short-lived token from `sessionStorage`, checks its local
`exp`, and validates it through `/users/me`. There is no public `restore()`
command because recovery is a lifecycle invariant rather than a caller action.

`AuthState` is `restoring | anonymous | authenticated | forbidden | error`.
Consumers render these states directly. Token rejection settles on `anonymous`;
an allow-list rejection settles on `forbidden`; failures that prevent
validation settle on `error`.

Token expiry uses a timer armed after validation. `getState()` remains a pure
snapshot read and never mutates state during React render.

### 4. Only `401` invalidates an established session

The shared API auth middleware signs out on `401` alone. This API uses `403` for
domain permissions, so treating every `403` as auth invalidation would log users
out of ordinary feature denials.

The special `403` from `/users/me` is handled during validation and becomes the
`forbidden` auth state.

## Constraint: fake auth stays offline

`FakeAuthProvider` makes no network calls. Web e2e runs with
`VITE_FAKE_AUTH=true` and the API mocked at the Playwright layer, so a real
request would break the suite.

The fake session starts authenticated, mints its local JWT on demand, and
exposes a concrete `authenticate()` method used only by its bound
`FakeSignInButton`. It is an identity-provider adapter for development and e2e,
not a second implementation of backend session validation.

## Trade-offs

- **Gained:** one reliable Google acquisition path; no One Tap promise,
  notification, or timeout state; stale validations cannot undo logout or
  overwrite newer credentials; callers receive the correct sign-in affordance
  without provider checks.
- **Lost:** `AuthSystem` is React-aware through `SignInButton`. This is accepted
  because identity acquisition is provider-owned UI and the module is web-only.
- **Accepted:** `AuthSession` outlives individual authenticated sessions. Its
  name denotes ownership of their lifecycle, including the anonymous periods
  between them.
- **Accepted:** a token-expiry timer flips an idle tab to anonymous without a
  network call. The next request's `401` would reach the same state.
