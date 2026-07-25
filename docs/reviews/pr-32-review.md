# PR #32 Review

Reviewed diff: `main...HEAD` on branch `auth-v1.1` for PR [#32](https://github.com/jeremy-dardour/wedding-planner/pull/32).

## Findings

### 1. High: transport-driven logout bypasses the React seam, so the UI can keep rendering protected state after a `401`

`createAuthMiddleware()` logs out on `401` responses, but the API client is wired to the raw provider from bootstrap, not the wrapped provider inside `AuthProviderBoundary`:

- `apps/web/src/api/configure-api-client.ts:10-21`
- `apps/web/src/bootstrap.ts:5-10`
- `apps/web/src/auth/auth-provider-boundary.tsx:18-30`
- `apps/web/src/api/middlewares/auth-middleware.ts:17-22`

The only place that forces React consumers to refresh is the boundary wrapper's `login()` / `logout()` methods. When the middleware calls `logout()` on the raw provider, the token and local auth state are cleared, but no React state update happens. That leaves `ProtectedRoute`, the header, and any other auth consumers free to keep rendering the previously authenticated UI until some unrelated rerender happens.

This is now user-visible because this PR adds session restore and token invalidation paths. The design explicitly requires route states to move cleanly between `authenticated`, `sign-in`, `forbidden`, and `error` (`docs/sessions/session-15-2026-07-24-auth-session-restore-plan.md:75-81`). With the current seam placement, a server-side `401` does not reliably move the UI out of the authenticated state.

Suggested fix: move the refreshing seam so all logout paths go through the same adapter. For example, let the API middleware signal through the boundary-wrapped auth object, or give the provider a subscription/notification mechanism so transport-driven logout also invalidates React consumers.

### 2. Medium: normal API `403` responses do not clear the stored token or transition to the forbidden state

The spec for this work says to clear the stored token on logout, expiry, `401`, and `403` (`docs/sessions/session-15-2026-07-24-auth-session-restore-plan.md:75-81`). The provider correctly maps `403` from `/api/users/me` validation into `AuthError('forbidden')`:

- `apps/web/src/auth/google-auth-provider.ts:380-405`

But the shared API middleware only reacts to `401`:

- `apps/web/src/api/middlewares/auth-middleware.ts:17-22`

That means the "forbidden" flow only works during initial restore/login validation. If a previously allowed user is later removed from `AUTH_ALLOWED_EMAILS`, subsequent API calls will return `403`, but the browser keeps the Google ID token in `sessionStorage` and the client stays locally authenticated until refresh or expiry. Server-side authorization still blocks access, but the client state is out of sync with the contract this PR documents.

Suggested fix: treat `403` as an auth-invalidating response for this app's stateless auth flow, clear local auth state, and route the UI into the forbidden state instead of leaving the provider authenticated.

## Codebase-Design / Overengineering

The main auth module is mostly moving in the right direction. `GoogleAuthProvider` has become a deeper module: more behavior is hidden behind the same small `AuthProvider` interface, which improves leverage for callers and locality for future auth fixes.

The part that still feels shallow is the logout seam. React refresh behavior lives in `AuthProviderBoundary`, while transport-driven invalidation lives in `createAuthMiddleware`, and they operate on different adapters. That split creates cross-module knowledge and is the root cause of finding 1.

I do not see major overengineering beyond that seam split. One minor watchpoint: `GoogleAuthProviderDependencies` (`apps/web/src/auth/google-auth-provider.ts:54-95`) is a public constructor seam used mainly to make the concrete implementation easy to test. Per the `codebase-design` lens, that is a hypothetical seam with one production adapter. It is acceptable for now, but if more test-only collaborators get added, I would hide that behind a module-local factory/helper so the concrete module's interface does not widen just for tests.

## Testing Gaps

- No test covers a `401` from ordinary API traffic causing the UI to leave protected content.
- No test covers a `403` from ordinary API traffic clearing session storage and surfacing the forbidden state.
