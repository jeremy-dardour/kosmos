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

### 2. `AuthSession` is a state machine, and nothing else

Five members, no DOM:

```ts
getState(): AuthState                      // one snapshot, discriminated union
subscribe(listener): () => void            // read via useSyncExternalStore
signIn(): Promise<void>
signOut(): void
getAccessToken(): Promise<string>
```

Named `AuthSession`, not `AuthProvider`: in React that name reads as a context
provider component, and this is neither a component nor a React thing. The
concrete implementations keep the `…AuthProvider` suffix — they are what
provides a session.

`AuthState` is `restoring | anonymous | authenticated | forbidden | error`.
Consumers render from the status directly, so no component derives a parallel
view-state enum or holds a rerender counter.

**`signOut()` takes no argument.** It once took the `AuthError` that caused the
sign-out, which the provider mapped onto the next state. That was inert in
practice: the one caller passing a reason was the 401 middleware, and
`token_rejected` mapped to `anonymous` — exactly what a bare `signOut()` does.
It was also a divergence the type could not catch, since the fake provider
mapped the same argument to `error`. Non-anonymous outcomes (`forbidden`,
`error`) are only ever reached from inside token validation, which is where
they are now set.

Two rules the types cannot carry:

- **`getState()` must return a stable reference until the state changes.**
  `useSyncExternalStore` loops if handed a fresh object per call.
- **Session recovery happens on construction, not on a caller's command.** The
  provider starts at `restoring` and settles itself. An explicit `restore()`
  would put back a method whose real contract — returns nothing, throws on some
  failures but not others, check a separate accessor afterwards — was invisible
  at the signature.

The concrete providers take no injected dependencies. An optional
`{ validateToken, storage, now }` bag existed for tests that never used it —
the specs drive the provider through the real `sessionStorage`, a stubbed
`fetch`, and fake timers.

### 3. The sign-in affordance ships beside the session, not inside it

Google's One Tap prompt (`prompt()`, the callback-only path) is suppressed
unpredictably by browser state — it is what produced the FedCM `AbortError`
that made the first unauthenticated landing unusable. The reliable interactive
path is `renderButton`, where Google renders its own iframe. So a sign-in
affordance cannot always be "a button wired to `signIn()`", and it is
provider-specific: the fake needs nothing but an `onClick`.

Putting `renderSignInButton(container: HTMLElement)` on the shared interface
forced every adapter to implement a widget it may not need, and put a DOM node
in an otherwise DOM-free interface. Instead a single `<SignInButton />`
component branches on the concrete session in context:

```tsx
session instanceof GoogleAuthProvider ? <GoogleSignInButton … /> : <FakeSignInButton />
```

`createAuth()` therefore returns an `AuthSession` and nothing else — it briefly
returned a `{ provider, signInButton }` pair, which put a rendered element in
the context value for every consumer to carry.

`GoogleAuthProvider.renderSignInButton` survives as a concrete method that only
`GoogleSignInButton` calls. It **must render into a node it creates and clean up
only that node**: callers' effects run twice under React StrictMode, so a
cleanup that cleared the whole container would delete the other call's button.

Loading the GIS script follows the same rule in reverse — a script tag already
in the document must be **awaited, not replaced**. Removing and re-adding it
restarts the download and races two copies.

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

- **Gained:** the endpoint has one home; the interface went from ten members to
  five, with no DOM and no arguments that only one implementation honours;
  `AuthProviderBoundary` and both `useReducer` rerender hacks deleted
  themselves; the context value is a bare session, stable, so `useAuth()` is
  safe in a dependency array; dev/e2e stays offline and fast.
- **Lost:** `SignInButton` needs an `instanceof` check against a concrete class,
  which is the price of not carrying the widget on the interface. Tests that
  drive auth need a state stub (`@/testing/stub-auth`) rather than an ad-hoc
  object literal.
- **Accepted:** `signIn()` still rejects _and_ records the failure in state.
  Callers can use either; the state is the one consumers should read.
- **Accepted:** a token-expiry timer flips an idle tab to anonymous with no
  network call. The next request's 401 would reach the same state, so this
  buys UX on an idle tab for ~30 lines.
