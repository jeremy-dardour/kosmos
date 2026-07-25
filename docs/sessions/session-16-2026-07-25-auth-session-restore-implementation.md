# Session 16 — Auth Session Restore Implementation (2026-07-25)

## Context

Implemented GitHub issue
[#30 — T-9: Backend-validated auth session restore](https://github.com/jeremy-dardour/wedding-planner/issues/30)
on branch `auth-v1.1`.

This continues the prior planning session in
[session-15-2026-07-24-auth-session-restore-plan.md](./session-15-2026-07-24-auth-session-restore-plan.md).

Unrelated worktree items were left untouched:

- `info-dont-commit-process-google-registration`
- `package.json`
- `packages/shared/package.json`
- `turbo.json`

## What Changed

### Backend

- Added `GET /api/users/me` in
  [apps/api/src/modules/user/user.controller.ts](../../apps/api/src/modules/user/user.controller.ts).
- Added `CurrentUserDto` in
  [apps/api/src/modules/user/dtos/output/current-user.dto.ts](../../apps/api/src/modules/user/dtos/output/current-user.dto.ts).
- Wired `UserController` into
  [apps/api/src/modules/user/user.module.ts](../../apps/api/src/modules/user/user.module.ts).
- Extended auth e2e coverage in
  [auth.e2e-spec.ts](../../apps/api/src/__e2e-tests__/auth.e2e-spec.ts)
  for:
  - `200` valid current user
  - `401` missing auth
  - `403` disallowed email

### Frontend

- Added typed auth errors in
  [apps/web/src/auth/auth-error.ts](../../apps/web/src/auth/auth-error.ts).
- Migrated frontend auth user shape to server-trusted fields in
  [apps/web/src/auth/types.ts](../../apps/web/src/auth/types.ts):
  - `id`
  - `email`
  - `name`
  - `avatarUrl?`
- Updated
  [apps/web/src/auth/google-auth-provider.ts](../../apps/web/src/auth/google-auth-provider.ts)
  to:
  - restore from stored Google ID token before prompting GIS
  - validate via `GET /api/users/me`
  - persist the token in `sessionStorage`
  - clear invalid/expired/forbidden tokens
  - keep login idempotent while restore/prompt is in flight
- Updated
  [apps/web/src/app/components/protected-route.tsx](../../apps/web/src/app/components/protected-route.tsx)
  to render explicit states:
  - checking
  - sign-in
  - forbidden
  - error
- Updated fake auth and affected frontend tests to use the new user shape.

### API Contract

- Generated updated OpenAPI types in
  [packages/api-contracts/src/openapi.d.ts](../../packages/api-contracts/src/openapi.d.ts)
  with the new `/api/users/me` operation and `CurrentUserDto`.

## Notable Decision

The implementation uses `sessionStorage`, not `localStorage`, for the temporary
Google ID token restore path.

Reason:

- refresh in the same tab still works
- persistence is limited to the tab lifetime
- it matches the narrower persistence requirement from session 15

## Validation

Passed:

- `pnpm lint`
- `pnpm check-types`
- `pnpm test`
- `pnpm build`
- `pnpm --filter api test:e2e -- auth.e2e-spec.ts`
- `pnpm test:e2e` (required unsandboxed execution so local test servers could bind ports)
- `pnpm generate:api-types` (required a running local API and unsandboxed localhost access)

## Environment Notes

- Running the local API with real auth (`FAKE_AUTH=false`) still depends on OIDC
  discovery reaching Google during bootstrap.
- OpenAPI generation succeeded by starting the API with `FAKE_AUTH=true` long
  enough to expose `/openapi.yaml`.
