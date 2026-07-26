# Session 18 — Auth Unauthenticated UX WIP (2026-07-25)

## Context

Work started from user feedback on PR #32:

- the unauthenticated/waiting page was too bare
- loading the site while not Google-authenticated waited too long before showing
  a sign-in action
- clicking the custom sign-in button logged:
  `Not signed in with the identity provider` and
  `[GSI_LOGGER]: FedCM get() rejects with AbortError: signal is aborted without reason`

This was also considered alongside the prior PR review:

- [docs/reviews/pr-32-review.md](../reviews/pr-32-review.md)

## What changed in the working tree

### Auth interface

Extended `AuthProvider` with:

- `restore()` for non-interactive same-tab session recovery
- `getAuthError()` for route-level auth state display
- `renderSignInButton(container)` so the Google provider can own the official
  Google-rendered sign-in button
- `onChange(listener)` so auth state changes outside React can refresh consumers

Files touched:

- `apps/web/src/auth/auth-provider.interface.ts`
- `apps/web/src/auth/google-auth-provider.ts`
- `apps/web/src/auth/fake-auth-provider.ts`
- `apps/web/src/auth/auth-provider-boundary.tsx`

### Protected route / landing page

Changed `ProtectedRoute` so initial mount calls `auth.restore()` instead of
`auth.login()`.

Important behavior change:

- page load no longer invokes GIS/FedCM prompt automatically when no stored
  token exists
- no stored session falls through quickly to a visible unauthenticated landing
  page
- the visible sign-in area delegates Google button rendering to the provider

File touched:

- `apps/web/src/app/components/protected-route.tsx`

### API auth invalidation

Adjusted auth middleware so:

- `401` calls `auth.logout(AuthError('validation_failed', ...))`
- `/users/me` `403` calls `auth.logout(AuthError('forbidden', ...))`
- generic domain `403` responses do not log the user out

This avoids the earlier over-broad idea of treating every `403` as auth
invalidation, because the API also uses `403` for domain permissions.

Files touched:

- `apps/web/src/api/middlewares/auth-middleware.ts`
- `apps/web/src/api/__tests__/auth-middleware.spec.ts`

### Tests updated

Updated test doubles and added/adjusted coverage for:

- silent restore instead of automatic login on protected route mount
- fast no-session landing state
- Google provider `restore()`
- Google provider `renderSignInButton()`
- auth boundary refresh when provider changes outside React
- `/users/me` `403` logout without logging out on generic domain `403`

Files touched:

- `apps/web/src/app/components/__tests__/protected-route.spec.tsx`
- `apps/web/src/auth/__tests__/google-auth-provider.spec.ts`
- `apps/web/src/auth/__tests__/auth-context.spec.tsx`
- `apps/web/src/auth/__tests__/create-auth-provider.spec.ts`
- `apps/web/src/auth/__tests__/fake-auth-provider.spec.ts`
- `apps/web/src/app/components/layout/__tests__/layout-header.spec.tsx`
- `apps/web/src/app/components/layout/__tests__/user-menu.spec.tsx`

## Validation run

Passed:

- `pnpm --filter web lint`
- `pnpm --filter web test`
- `pnpm --filter web check-types`
- `pnpm --filter web build`

Notes from test output:

- Vitest still prints existing warnings about nested `vi.mock()` calls in
  `app-layout.spec.tsx`.
- Vite still prints existing advisory warnings about `vite-tsconfig-paths` and
  `@vitejs/plugin-react-swc`.
- Build still warns that the main JS chunk is over 500 kB.

## Visual check

Started the web dev server at:

- `http://127.0.0.1:28954/`

Captured a screenshot to:

- `/private/tmp/wedding-auth-landing.png`

Observation:

- the unauthenticated landing page rendered quickly and was not blank
- the current visual is sparse but more presentable than the previous text-only
  state
- the Google button area was empty in the screenshot after a 1 second wait

## Blocker / unfinished work

The user stopped the turn before the next fix could be applied.

The main remaining blocker is the provider-rendered Google button loading state:

- the landing page can show `No active session was found.`
- but the sign-in button slot may look empty while the GIS script is still
  loading or if the script fails

Recommended next step:

- make `ProviderSignInButton` show a visible `Preparing Google sign-in...` state
  while `renderSignInButton()` is pending
- show the fallback local button only if rendering fails
- then visually re-check the page after 1 second and after a longer wait

## Learning / design notes

- The slow unauthenticated path came from using `auth.login()` on
  `ProtectedRoute` mount. `login()` could enter `google.accounts.id.prompt()`,
  whose FedCM prompt outcome can be slow or fail with browser-specific
  `AbortError` logs.
- `restore()` is the smaller reliable interface: it only checks `sessionStorage`
  and `/users/me`, and never invokes Google/FedCM.
- The Google-rendered button is the right owner for interactive sign-in. It keeps
  GIS details inside `GoogleAuthProvider` instead of leaking them into route UI.
- The auth invalidation review finding is best fixed with provider change
  notifications, not a global event bus or broad state machine.
- Do not log out on every `403`; only auth validation `403` should become a
  forbidden auth state.

## Current state

Work is uncommitted.

Unrelated local files still present:

- `info-dont-commit-process-google-registration`
- `todo.md`
