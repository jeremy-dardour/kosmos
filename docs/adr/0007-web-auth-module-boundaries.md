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
endpoint exists. `CurrentUser` is derived from the generated `CurrentUserDto`,
so contract drift surfaces as a type error rather than a runtime surprise.

It deliberately uses `fetch` rather than the shared openapi-fetch client: it
runs _during_ authentication, before a session exists, and the client's auth
middleware logs out on 401 — precisely the response this call exists to report.

### 2. Page load restores; it never prompts

`ProtectedRoute` calls `restore()` on mount, never `login()`. `restore()` only
reads `sessionStorage` and validates against the API — it never touches
GIS/FedCM. Interactive sign-in is delegated to `renderSignInButton(container)`,
so the provider renders Google's own button and GIS details never leak into
route UI.

`renderSignInButton` **must render into a node it creates and clean up only
that node.** Callers' effects run twice under React StrictMode, so a cleanup
that cleared the whole container would delete the other call's button.

### 3. Only 401 invalidates the session

The API auth middleware logs out on `401` alone. `403` is a domain permission
code in this API, so treating it as auth invalidation would log users out of
ordinary feature denials. The forbidden case is handled where it actually
occurs — inside `fetchCurrentUser`, which maps `403` to
`AuthError('forbidden')`.

### 4. `AuthProviderBoundary` recreates its context object every render

This is load-bearing, not an oversight. React context propagates by value
identity, so memoizing the object stops consumers re-rendering when auth
changes. See the comment in `auth-provider-boundary.tsx`.

## Constraint: fake auth must stay offline

`FakeAuthProvider` must make **no network calls**. Web e2e runs with
`VITE_FAKE_AUTH=true` _and_ the API mocked at the Playwright layer
(`PLAYWRIGHT_USE_API_MOCK`), so a real request would break the suite. Fake auth
exists to make the web app e2e-testable without Google — not to be a second
implementation of session validation.

API-side, `MockAuthStrategy` is unused by API e2e (`.env.e2e` sets
`FAKE_AUTH=false`), so its hardcoded identity never meets the web's.

## Trade-offs

- **Lost:** `AuthProvider` is a wide interface (10 methods) expressing one state
  machine through five accessors, which forces `useReducer` rerender hacks in
  `AuthProviderBoundary` and `ProtectedRoute`, and makes consumers that use
  `auth` as an effect dependency re-run on every auth change.
- **Gained:** the endpoint has one home, dev/e2e stays offline and fast, and
  StrictMode double-mounting is safe.
- **Revisit:** collapsing the interface to `getState()` + `subscribe()` read via
  `useSyncExternalStore` is tracked in
  [issue #33](https://github.com/jeremy-dardour/wedding-planner/issues/33).
  That removes both rerender hacks and the boundary trap in (4).
