# Session 14 — Auth PR #29 Rebase Cleanup (2026-07-24)

## What was done

- Reb​​ased `fix-auth` onto `main`, which already contains PR #28's entity and
  migration work.
- Resolved PR #29 conflicts by keeping `main` as source of truth for:
  - `User` entity
  - MikroORM migration snapshot
  - existing entity migration history
  - `docs/current-state.md`
- Dropped PR #29's duplicate user migration from the rebased branch.
- Kept the auth-specific implementation:
  - Google JWT claim verification
  - email allow-list behavior
  - `ForbiddenEmailException`
  - request user provisioning through `AuthUserProvisionerService`
  - Google web auth provider
  - updated env examples and tests

## Auth simplification

- Removed the web auth event bus:
  - removed `AuthEvent`
  - removed unused `AuthMessage`
  - removed provider-side `CustomEvent` dispatches
  - removed `useSyncExternalStore` from `ProtectedRoute`
- Reworked `ProtectedRoute` to call `auth.login()` directly and rerender after
  the login promise settles.
- Added `AuthProviderBoundary`, a small React boundary that refreshes auth
  consumers after `login()` and `logout()` without relying on global browser
  events.

## Provisioner cleanup

- Kept `AuthUserProvisionerService` as the boundary for "ensure local user
  exists" behavior.
- Removed manual `updatedAt` assignment from the provisioner.
- Relied on `User.updatedAt`'s MikroORM `onUpdate` from `main`.

## API type generation port fix

- Updated root `pnpm generate:api-types` to source `apps/api/.env` before
  running `openapi-typescript`.
- The command now uses `http://localhost:${PORT:-3000}/openapi.yaml`, so
  workspaces created by `scripts/setup_parallel_workspace.sh` generate types
  from the API's configured port instead of hardcoded port `3000`.
- Updated `packages/api-contracts/README.md` to document the dynamic port.

## CI fake-auth boot fix

- Fixed API boot in CI contract generation when `FAKE_AUTH=true`.
- `OidcDiscoveryService` no longer parses `AUTH_OIDC_DISCOVERY_URL` in its
  constructor. URL parsing is now lazy inside `init()`, which
  `AuthInitializerService` already skips for fake auth.
- This allows CI to start the API for `/openapi.yaml` without providing real
  OIDC configuration.

## Auth v1.1 ticket planning

- Manual Google auth testing exposed follow-up gaps in the first auth pass:
  - a Google account outside `AUTH_ALLOWED_EMAILS` could briefly enter the web
    app because the frontend treated the GIS credential callback as sufficient
    authentication before any backend call ran
  - the displayed user name/avatar came from client-decoded Google claims rather
    than the backend-provisioned app user
  - browser refresh lost auth state because the Google ID token only lived in
    memory
  - GIS/FedCM failures in private browsing could leave the protected route blank
    instead of showing a sign-in or error state
- Decided to keep the backend stateless:
  - no server-side session
  - no backend refresh-token storage
  - persist only the short-lived Google ID token in web `localStorage`
  - clear the token on logout, expiry, `401`, or `403`
- Designed `GET /api/users/me` as the backend validation/current-user endpoint:
  - protected by the existing auth guard
  - verifies the Google token
  - checks `AUTH_ALLOWED_EMAILS`
  - provisions/updates the `User`
  - returns the server-trusted current user as `{ id, email, name, avatarUrl }`
- Defined the frontend flow:
  - `GoogleAuthProvider.login()` first tries to restore from a stored,
    non-expired ID token through `/api/users/me`
  - if restore fails or no token exists, GIS is prompted
  - after GIS returns a credential, the provider stores it temporarily and calls
    `/api/users/me`
  - frontend authenticated state is set only after `/api/users/me` succeeds
  - decoded Google claims may be used only for local expiry checks, not rendered
    identity data
  - `ProtectedRoute` should render explicit `checking`, `sign-in`,
    `authenticated`, `forbidden`, and `error` states
- Updated
  [docs/specs/v1-tech-design.md](../specs/v1-tech-design.md#auth-validation-and-restore-follow-up)
  with the full flow, rationale, expected API status semantics, and test
  requirements.
- Created
  [#30 — T-9: Backend-validated auth session restore](https://github.com/jeremy-dardour/wedding-planner/issues/30)
  using the ticket format:
  - backend endpoint and DTO requirements
  - frontend behavior and affected modules
  - key decisions and rationale
  - references and done-when checklist
- Linked #30 into the V1 tech design build sequence as a required auth
  hardening follow-up after #25.

## Validation

- `pnpm --filter web test`
- `pnpm --filter api test`
- `pnpm --filter web check-types`
- `pnpm --filter api check-types`
- `pnpm --filter web lint`
- `pnpm --filter api lint`
- `pnpm db:start`
- `pnpm --filter api db-e2e:migrate:fresh`
- `pnpm --filter api test:e2e`
- `pnpm generate:api-types`
- `pnpm --filter api check-types`
- `pnpm --filter api lint`
- `pnpm --filter api test`
- `git diff --check`

## Notes

- The first API e2e run inside the sandbox failed because Supertest could not
  bind to `0.0.0.0` (`listen EPERM`). Rerunning outside the sandbox worked.
- The next API e2e run failed because the test database schema had not been
  migrated. After `db-e2e:migrate:fresh`, all API e2e tests passed.
- `pnpm generate:api-types` was verified against the already-running API on
  port `26873`.
- CI contract generation was failing because the API instantiated
  `OidcDiscoveryService` with no `AUTH_OIDC_DISCOVERY_URL` under
  `FAKE_AUTH=true`. Lazy URL parsing fixes that startup path.
- The local Postgres containers were started during validation and left running.

## Status at end of session

`fix-auth` is rebased on `main`, auth event overengineering is removed, the
duplicate user migration/snapshot changes are gone, and the branch passes unit,
type, lint, API e2e, and API type generation verification.

Later addendum: branch `auth-v1.1` now contains the uncommitted tech-design
update for #30. No implementation for #30 has been started yet.
