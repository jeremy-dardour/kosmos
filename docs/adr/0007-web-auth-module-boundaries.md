# ADR 0007: Web auth module boundaries

**Status:** Accepted — 2026-07

Supersedes the frontend-flow details in
[V1 Tech Design § Auth](../specs/v1-tech-design.md#auth), which described
`GoogleAuthProvider.login()` as the single entry point used by `ProtectedRoute`.

## Decision

Four boundaries in the web auth module.

### 1. Acquiring a token and validating a session are separate concerns

`AuthProvider` implementations own **identity acquisition only** — the
Google-specific business of getting an ID token out of GIS. Exchanging any
token for "who is this in our app" is provider-agnostic and lives in
`apps/web/src/api/current-user.ts`:

```ts
fetchCurrentUser(token): Promise<CurrentUser>   // owns GET /api/users/me
```

It maps HTTP status onto `AuthError` codes and is the only place that knows the
endpoint exists. `CurrentUser` is derived from the generated OpenAPI `paths`, so
contract drift surfaces as a type error rather than a runtime surprise.

It deliberately uses `fetch` rather than the shared openapi-fetch client: it
runs _during_ authentication, before a session exists, and the client's auth
middleware signs out on 401 — precisely the response this call exists to report.

### 2. `AuthProvider` is a state machine, and nothing else

Five members, no DOM:

```ts
getState(): AuthState                      // one snapshot, discriminated union
subscribe(listener): () => void            // read via useSyncExternalStore
signIn(): Promise<void>
signOut(reason?: AuthError): void
getAccessToken(): Promise<string>
```

`AuthState` is `restoring | anonymous | authenticated | forbidden | error`.
Consumers render from the status directly, so no component derives a parallel
view-state enum or holds a rerender counter.

Two rules the types cannot carry:

- **`getState()` must return a stable reference until the state changes.**
  `useSyncExternalStore` loops if handed a fresh object per call.
- **Session recovery happens on construction, not on a caller's command.** The
  provider starts at `restoring` and settles itself. An explicit `restore()`
  would put back a method whose real contract — returns nothing, throws on some
  failures but not others, check a separate accessor afterwards — was invisible
  at the signature.

### 3. The sign-in affordance ships beside the provider, not inside it

Rendering a sign-in widget is provider-specific: Google must render its own
iframe button, a fake needs nothing but an `onClick`. Putting
`renderSignInButton(container: HTMLElement)` on the shared interface forced
every adapter to implement a widget it may not need, and put a DOM node in an
otherwise DOM-free interface.

`createAuth()` therefore returns the pair:

```ts
{ provider: AuthProvider, signInButton: React.ReactNode }
```

An element, not a component type — built once, so rendering it never creates a
component during another component's render.

`GoogleAuthProvider.renderSignInButton` survives as a concrete method that only
`GoogleSignInButton` calls. It **must render into a node it creates and clean up
only that node**: callers' effects run twice under React StrictMode, so a
cleanup that cleared the whole container would delete the other call's button.

Token expiry is handled by a timer armed when the session is established, not by
a check inside `getState()` — `getState()` is read during render and could not
report a lapse without mutating mid-render.

### 4. Only 401 invalidates the session

The API auth middleware signs out on `401` alone. `403` is a domain permission
code in this API, so treating it as auth invalidation would sign users out of
ordinary feature denials. The forbidden case is handled where it actually
occurs — inside `fetchCurrentUser`, which maps `403` to `AuthError('forbidden')`.

## Constraint: fake auth must stay offline

`FakeAuthProvider` must make **no network calls**. Web e2e runs with
`VITE_FAKE_AUTH=true` _and_ the API mocked at the Playwright layer
(`PLAYWRIGHT_USE_API_MOCK`), so a real request would break the suite. Fake auth
exists to make the web app e2e-testable without Google — not to be a second
implementation of session validation.

API-side, `MockAuthStrategy` is unused by API e2e (`.env.e2e` sets
`FAKE_AUTH=false`), so its hardcoded identity never meets the web's.

## Trade-offs

- **Gained:** the endpoint has one home; `AuthProvider` went from ten members to
  five with no DOM; `AuthProviderBoundary` and both `useReducer` rerender hacks
  deleted themselves; the context value is now stable, so `useAuth()` is safe in
  a dependency array; dev/e2e stays offline and fast.
- **Lost:** `createAuth()` returns a pair rather than a provider, so the factory
  is the one place that knows both halves. Tests that drive auth need a state
  stub (`@/testing/stub-auth`) rather than an ad-hoc object literal.
- **Accepted:** `signIn()` still rejects _and_ records the failure in state.
  Callers can use either; the state is the one consumers should read.
