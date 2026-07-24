# Session 15 — Auth Session Restore Plan (2026-07-24)

## Context

Target work is technical build-sequence row 9 in
[docs/specs/v1-tech-design.md](../specs/v1-tech-design.md#technical-independent):

- GitHub issue:
  [#30 — T-9: Backend-validated auth session restore](https://github.com/jeremy-dardour/wedding-planner/issues/30)
- Scope: `/api/users/me`, stored Google ID-token restore, explicit auth states.
- Blocking status: required before production.

Important clarification: GitHub issue #9 is closed and refers to an older UI
workstream card-list slice. It is not the auth work. The "issue 9" auth work is
row 9 in the technical build sequence, which maps to GitHub #30.

Current branch during planning: `auth-v1.1`.

Current working tree note during planning:

- `?? info-dont-commit-process-google-registration`

That file appears unrelated and should not be staged or modified as part of this
auth implementation unless explicitly requested.

## Relevant Specification

Primary spec:

- [docs/specs/v1-tech-design.md#auth-validation-and-restore-follow-up](../specs/v1-tech-design.md#auth-validation-and-restore-follow-up)

Relevant requirements:

- Keep auth stateless.
- Do not add backend sessions, cookies, refresh-token storage, or server-side
  session lookup.
- Do not treat a raw Google GIS credential as an authenticated app session.
- Backend remains the source of truth for:
  - Google token validity
  - `AUTH_ALLOWED_EMAILS`
  - user provisioning/updating
  - current app user display data
- Add `GET /api/users/me`.
- Route is protected by the existing auth guard.
- The auth guard verifies the token, checks the allow-list, provisions/updates
  `User`, and attaches the authenticated user to the request.
- Controller returns the server-trusted current user as:

```ts
interface CurrentUserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
```

Expected status semantics:

- `200`: token valid, email allow-listed, user provisioned/updated, body is the
  current app user.
- `401`: token missing, malformed, expired, wrong issuer/audience, invalid
  signature, or rejected by Google/JWT validation.
- `403`: token valid but email is not allow-listed, or email is not verified.

Frontend requirements:

- `GoogleAuthProvider.login()` remains the single entry point used by
  `ProtectedRoute`.
- If another login/restore is already in flight, return the existing promise.
- Try stored token restore first.
- Decode the Google ID token only for local `exp` checks.
- Never render user identity from decoded Google claims.
- Call `/api/users/me` before marking the frontend authenticated.
- Clear stored token on logout, expiry, `401`, and `403`.
- Explicit route states:
  - `checking`
  - `sign-in`
  - `authenticated`
  - `forbidden`
  - `error`
- No blank protected route on GIS/FedCM failure.

## Design Adjustment From Spec

The current tech-design text says the web app may persist the short-lived Google
ID token in `localStorage` so refresh works.

Plan adjustment: use `sessionStorage` instead of `localStorage`.

Reasoning:

- The desired behavior is "browser refresh keeps the user logged in while the ID
  token is still valid."
- `sessionStorage` survives same-tab reloads, which satisfies that requirement.
- `sessionStorage` clears when the tab closes and is not shared across tabs.
- `localStorage` persists longer and is shared across same-origin tabs, which is
  more persistence than the product needs.
- Neither `localStorage` nor `sessionStorage` protects tokens from XSS. This is
  a tradeoff accepted for the small V1 private app while avoiding backend
  sessions/BFF/cookies.

This is a deliberate resilience/simplicity tradeoff:

- More secure than `localStorage` for this requirement.
- Less complex than introducing `HttpOnly` cookie sessions or a BFF.
- Still stateless on the backend.

If cross-tab persistence becomes required later, revisit the auth architecture
instead of silently switching to `localStorage`.

## Codebase-Design Lens

Use the `codebase-design` vocabulary and keep module depth in mind.

Primary frontend module:

- `GoogleAuthProvider`

Its interface should remain small:

```ts
interface AuthProvider {
  initialize(): void | Promise<void>;
  login(): void | Promise<void>;
  logout(): void | Promise<void>;
  isAuthenticated(): boolean;
  getAuthenticatedUser(): AuthenticatedUser | null;
  getAccessToken(): Promise<string>;
}
```

Do not add a global auth event bus, broad auth store, reducer framework, or
external auth state machine. Those would expand the public interface without
enough leverage.

Desired depth:

- `GoogleAuthProvider` owns the complex implementation:
  - GIS script loading
  - prompt handling
  - concurrent login promise reuse
  - token storage
  - local expiry checks
  - `/api/users/me` validation
  - user state
  - token clearing
  - typed auth failures
- Callers only know:
  - call `login()`
  - check `isAuthenticated()`
  - get current user/token through the existing interface

Backend module shape:

- Keep `AuthGuard` as the authority for authentication/provisioning.
- Add a thin `UserController.me()` endpoint that returns `request.user`.
- Do not add a current-user decorator yet. One endpoint does not justify a new
  seam. Add it later if multiple controllers need the same request-user access.
- Do not create `UserService` solely for `me`; current behavior is already owned
  by `AuthUserProvisionerService`.

Internal test seam:

- It is acceptable for `GoogleAuthProvider` to accept an internal validation
  dependency such as `validateToken(token)`, defaulting to direct `/api/users/me`
  fetch behavior, if it materially simplifies tests.
- Keep that seam internal to the provider implementation. Do not make app
  callers aware of it.

Testing strategy:

- Test behavior through module interfaces, not implementation details.
- API e2e should exercise the real Nest route/guard/provisioner path.
- Web provider tests should exercise `login()`, `logout()`,
  `getAuthenticatedUser()`, and `getAccessToken()`.
- `ProtectedRoute` tests should assert visible states and child rendering, not
  provider internals.

## Current Code Findings

Backend:

- `apps/api/src/app/auth/auth.guard.ts`
  - Selects mock vs JWT strategy.
  - Calls `authStrategy.authenticate(request)`.
  - Calls `AuthUserProvisionerService.provision(payload)`.
  - Sets `request.user` to the provisioned authenticated user.
- `apps/api/src/app/auth/auth-user-provisioner.service.ts`
  - Upserts `User` by normalized email.
  - Updates name/avatar.
  - Returns `{ id, email, name, avatarUrl }`.
- `apps/api/src/app/auth/strategies/jwt/jwt-auth.strategy.ts`
  - Extracts bearer token.
  - Verifies JWT.
  - Maps Google `picture` claim to `avatarUrl`.
- `apps/api/src/app/auth/strategies/jwt/jwt-verification.service.ts`
  - Validates issuer/audience/signature/payload shape.
  - Validates `AUTH_ALLOWED_EMAILS`.
  - Throws `ForbiddenEmailException` for missing/unverified/disallowed email.
- `apps/api/src/modules/user/user.module.ts`
  - Currently only imports `User` entity.
  - No controller yet.

Frontend:

- `apps/web/src/auth/auth-provider.interface.ts`
  - Small existing provider interface. Preserve it if possible.
- `apps/web/src/auth/google-auth-provider.ts`
  - Currently stores ID token only in memory.
  - Currently decodes token payload for `email` and `name`.
  - Currently marks authenticated after GIS credential callback, before backend
    validation.
  - Currently has concurrency handling through `loginPromise`.
  - Currently handles prompt dismissal and script load failure.
- `apps/web/src/app/components/protected-route.tsx`
  - Calls `auth.login()` when unauthenticated.
  - Renders children if authenticated.
  - Renders an empty fragment otherwise, including on failure.
- `apps/web/src/auth/auth-provider-boundary.tsx`
  - Re-renders auth consumers after `login()` and `logout()`.
  - Keep this small wrapper.
- `apps/web/src/app/components/layout/user-menu.tsx`
  - Only displays `user?.name`.
  - Avatar is not currently rendered.

## Authenticated User Shape

Use the server-trusted current app user shape in both backend DTO and frontend
auth type:

```ts
interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
```

Rationale:

- `id`, `email`, and `name` are necessary for current-user identity.
- `avatarUrl` is not necessary for authorization.
- Keep `avatarUrl` optional because:
  - it already exists on the `User` entity;
  - the backend provisioner already maps Google `picture` into it;
  - it is server-trusted user profile data;
  - keeping it avoids future pressure to decode Google claims in the UI for an
    avatar.

Do not use `username` in new frontend auth code. That is old fake-auth naming.
Migrate consumers/tests to `email`.

## Implementation Plan

### 1. Backend DTO

Create:

- `apps/api/src/modules/user/dtos/output/current-user.dto.ts`

Shape:

- `id: string` with Swagger UUID metadata.
- `email: string`.
- `name: string`.
- `avatarUrl?: string` with nullable/optional Swagger metadata.

Use existing DTO style from `apps/api/src/modules/item/dtos/output/item.dto.ts`.

### 2. Backend controller

Create:

- `apps/api/src/modules/user/user.controller.ts`

Endpoint:

- `GET /users/me`

Important route note:

- The API global prefix is already `/api`, so the controller path should be
  `users`, not `api/users`.

Implementation:

- Protected by default through the global/existing auth guard behavior.
- Inject no service unless needed.
- Use `@Req() request: AuthenticatedRequest`.
- Return `CurrentUserDto` built from `request.user`.

Swagger:

- `@ApiTags('Users')`
- `@ApiOperation(...)`
- `@ApiOkResponse({ type: CurrentUserDto })`
- Add problem-response metadata matching repo conventions if available.

### 3. Wire user module

Modify:

- `apps/api/src/modules/user/user.module.ts`

Add:

- `controllers: [UserController]`

Keep existing `MikroOrmModule.forFeature([User])`.

### 4. Backend tests

Modify:

- `apps/api/src/__e2e-tests__/auth.e2e-spec.ts`

Add tests against `/api/users/me`:

- Valid allow-listed token returns `200` and current user body:
  - `email: 'e2e@example.com'`
  - `name: 'E2E Test User'`
  - `avatarUrl: 'https://example.com/avatar.jpg'`
  - `id` is a UUID string.
- Missing auth header returns `401`.
- Disallowed email token returns `403`.

Existing protected endpoint tests can remain. These new tests specifically prove
the current-user endpoint contract.

### 5. API type generation

After backend endpoint is implemented and API starts:

- Run `pnpm generate:api-types`.

This should update:

- `packages/api-contracts/src/openapi.d.ts`
- `apps/web/src/types/openapi.d.ts` if repo scripts copy/sync it, or run the
  repo's established type-sync step if generation only updates package output.

Use generated path type for `/users/me` in frontend validation if ergonomic.
If generated types create friction, use a narrowly typed fetch result inside the
provider and keep the surface local.

### 6. Frontend auth type migration

Modify:

- `apps/web/src/auth/types.ts`

From:

```ts
interface AuthenticatedUser {
  username: string;
  name?: string;
}
```

To:

```ts
interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
```

Update consumers/tests:

- `FakeAuthProvider`
- `UserMenu` tests
- `LayoutHeader` tests
- `AuthContext` tests
- API middleware tests
- Google provider tests

`UserMenu` can continue displaying only `name`.

### 7. Fake auth compatibility

Modify:

- `apps/web/src/auth/fake-auth-provider.ts`

Return a fake user matching the new shape:

```ts
{
  id: '00000000-0000-4000-8000-000000000001',
  email: 'dev.user@example.com',
  name: 'DevUser',
}
```

`getAccessToken()` can continue using `generateFakeJwt(email, email)` if the API
mock auth path ignores the token details. Keep behavior stable for local/dev
tests.

### 8. Frontend auth errors

Add a small typed auth error.

Possible file:

- `apps/web/src/auth/auth-error.ts`

Possible shape:

```ts
export type AuthErrorCode =
  | 'forbidden'
  | 'sign_in_failed'
  | 'validation_failed';

export class AuthError extends Error {
  constructor(
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}
```

Keep this small. Avoid a large state machine.

Mapping:

- `/me` returns `403` -> `AuthError('forbidden', ...)`
- `/me` returns `401` -> clear token and continue to prompt if this was restore;
  if this was post-GIS validation, reject with `validation_failed`.
- GIS prompt dismissed/not displayed/skipped -> `sign_in_failed`
- script load failure -> `sign_in_failed`
- unexpected `/me` failure -> `validation_failed`

### 9. Frontend provider validation flow

Modify:

- `apps/web/src/auth/google-auth-provider.ts`

Core data:

- `private readonly storageKey = 'wedding-planner.google-id-token'`
- `private idToken: string | null = null`
- `private authenticatedUser: AuthenticatedUser | null = null`
- `private loginPromise: Promise<void> | null = null`

Storage:

- Use `globalThis.sessionStorage`.
- Read only when browser APIs exist.
- Clear gracefully if storage access throws.

Flow for `login()`:

1. If already authenticated, resolve.
2. If `loginPromise` exists, return it.
3. Start login/restore.

Flow for `startLogin()`:

1. Try `restoreFromStoredToken()`.
2. If restored, resolve.
3. If restore token missing/expired/unauthorized, clear token/storage and
   continue to GIS.
4. Initialize GIS lazily.
5. Prompt GIS.
6. When credential arrives:
   - decode only `exp` and reject if expired/malformed;
   - store token in memory and `sessionStorage`;
   - call `/api/users/me`;
   - on success, set `authenticatedUser` from response and resolve;
   - on `401`/`403`/unexpected failure, clear token/storage and reject typed
     error.

`restoreFromStoredToken()`:

- Read token from `sessionStorage`.
- If missing, return `false`.
- If locally expired or malformed, clear and return `false`.
- Validate through `/api/users/me`.
- On success:
  - set `idToken`
  - set `authenticatedUser`
  - return `true`
- On `401`:
  - clear
  - return `false` so user can be prompted
- On `403`:
  - clear
  - throw `AuthError('forbidden', ...)`
- On unexpected response/network:
  - clear
  - throw `AuthError('validation_failed', ...)`

`isAuthenticated()`:

- Return true only when:
  - `idToken` exists,
  - `authenticatedUser` exists,
  - token is not locally expired.
- If token is expired, clear local state before returning false if convenient.

`getAuthenticatedUser()`:

- Return `authenticatedUser` only if `isAuthenticated()`.

`getAccessToken()`:

- Return token only if `isAuthenticated()`.
- If expired/missing, clear token/storage and reject.

`logout()`:

- Clear token from memory.
- Clear authenticated user.
- Remove token from `sessionStorage`.
- Call `google.accounts.id.disableAutoSelect()` if available.
- Do not depend on GIS logout for app logged-out state.

Avoid:

- refresh token handling
- service worker token manager
- cookies
- backend session creation
- global auth event dispatching
- decoded claim rendering

### 10. `/api/users/me` frontend call

Preferred simple implementation inside `GoogleAuthProvider`:

```ts
private async fetchCurrentUser(token: string): Promise<AuthenticatedUser> {
  const response = await fetch(`${env.apiUrl}/users/me`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.ok) {
    return (await response.json()) as AuthenticatedUser;
  }

  if (response.status === 403) {
    throw new AuthError('forbidden', 'This Google account is not authorized.');
  }

  if (response.status === 401) {
    throw new AuthError('validation_failed', 'The Google credential was rejected.');
  }

  throw new AuthError('validation_failed', 'Could not validate the Google credential.');
}
```

Do not use the global `$api` client from inside the auth provider unless that is
straightforward without cycles. The global API client depends on the auth
provider for the auth middleware, so direct `fetch` may be the cleanest local
implementation for `/me`.

### 11. Protected route explicit states

Modify:

- `apps/web/src/app/components/protected-route.tsx`

Keep it simple:

- Local state:
  - `checking`
  - `sign-in`
  - `forbidden`
  - `error`
- On mount/unauthenticated:
  - set `checking`
  - call `auth.login()`
  - on success, rerender and show children
  - on `AuthError('forbidden')`, show forbidden state
  - on `AuthError('sign_in_failed')`, show sign-in retry state
  - on anything else, show error state

UI:

- Use existing `Button`.
- No marketing copy.
- Minimal but visible.
- Include retry action for sign-in/error states.
- Forbidden state should clearly say the Google account is not authorized for
  this app.

Potential copy keys can be added to i18n locales if the app requires all visible
text to be translated. Check existing app text conventions before hardcoding.

### 12. Web tests

Modify:

- `apps/web/src/auth/__tests__/google-auth-provider.spec.ts`
- `apps/web/src/app/components/__tests__/protected-route.spec.tsx`
- dependent auth/layout tests using old `username` shape

Provider tests to add/update:

- GIS credential does not mark authenticated until `/users/me` succeeds.
- User data comes from `/users/me`, not decoded token claims.
- Credential is stored in `sessionStorage` after GIS returns and validation
  succeeds.
- Refresh restore reads `sessionStorage`, calls `/users/me`, and avoids GIS
  prompt on success.
- Expired stored token is cleared and falls through to GIS prompt.
- Stored token rejected with `401` is cleared and falls through to GIS prompt.
- Stored token rejected with `403` is cleared and rejects with forbidden.
- Post-GIS `/me` `403` clears storage and rejects with forbidden.
- GIS/FedCM prompt failure rejects with sign-in failure.
- `logout()` clears memory and `sessionStorage`.

Route tests:

- Already authenticated -> renders children.
- Login success -> renders children.
- Login in flight -> visible checking state.
- Forbidden error -> visible forbidden state, no children.
- Sign-in/GIS failure -> visible sign-in retry state, no children.
- Generic validation failure -> visible error state, no children.

### 13. Verification

Expected focused commands:

```bash
pnpm --filter api test:e2e -- auth.e2e-spec.ts
pnpm --filter web test -- src/auth/__tests__/google-auth-provider.spec.ts
pnpm --filter web test -- src/app/components/__tests__/protected-route.spec.tsx
pnpm generate:api-types
pnpm --filter api check-types
pnpm --filter web check-types
pnpm --filter api lint
pnpm --filter web lint
git diff --check
```

Potential environment notes:

- API e2e may need the test database migrated first, as in session 14:
  `pnpm --filter api db-e2e:migrate:fresh`.
- In sandboxed execution, API e2e may fail to bind a local port. If that happens,
  rerun with the appropriate escalation rather than changing tests.
- `pnpm generate:api-types` requires the API server to be running and serving
  `/openapi.yaml` on the port from `apps/api/.env` or default `3000`.

### 14. Final documentation: auth ADR

After implementation and verification pass, create a new ADR under `docs/adr/`
describing the final V1 auth architecture and the decisions behind it.

Use the next ADR number in sequence. Current latest during planning is:

- `docs/adr/0006-same-parent-integrity-in-service-layer.md`

Likely new file:

- `docs/adr/0007-google-auth-and-stateless-session-restore.md`

The ADR should synthesize the corrected auth decisions from:

- [docs/specs/auth/PRD.md](../specs/auth/PRD.md)
- [docs/specs/v1-tech-design.md](../specs/v1-tech-design.md)
- [docs/sessions/session-11-2026-07-23-auth-google-oauth.md](./session-11-2026-07-23-auth-google-oauth.md)
- [docs/sessions/session-14-2026-07-24-auth-pr29-rebase-cleanup.md](./session-14-2026-07-24-auth-pr29-rebase-cleanup.md)
- this session plan
- the final implemented code

Minimum ADR content:

- Context:
  - tiny private V1 app;
  - Google Identity Services is the identity provider;
  - backend owns token verification, email allow-listing, and user provisioning;
  - frontend must not trust decoded Google claims for app authentication.
- Decision:
  - use GIS Google ID tokens as bearer tokens;
  - keep backend auth stateless;
  - no backend sessions, refresh-token storage, or server-managed cookies in V1;
  - protect app entry through `/api/users/me`;
  - persist the short-lived ID token in `sessionStorage` for same-tab refresh
    restore only;
  - decode the ID token client-side only for local expiry checks;
  - render current-user data from backend `/me` response;
  - keep fake auth as the local/dev/test adapter.
- Consequences:
  - refresh works in the same tab while the ID token is still valid;
  - closing the tab ends stored-token restore;
  - XSS can still read Web Storage, so CSP/output-encoding discipline matters;
  - production hardening can later revisit a BFF or `HttpOnly` cookie session if
    the threat model changes;
  - auth behavior remains localized behind the `AuthProvider` interface and
    backend auth guard.
- Rejected alternatives:
  - frontend trusting raw GIS credential callback;
  - `localStorage` for longer-lived/cross-tab restore;
  - backend server-side sessions;
  - refresh tokens in browser or backend;
  - global frontend auth event bus/state machine;
  - client-rendered identity from decoded Google claims.

This ADR should be created after code is done so it reflects the actual final
implementation rather than aspirational design.

## Acceptance Checklist

- [ ] `GET /api/users/me` exists and returns server-trusted current user data.
- [ ] `/users/me` is present in OpenAPI output.
- [ ] API e2e covers `/users/me` success, `401`, and `403`.
- [ ] Frontend auth user shape is `{ id, email, name, avatarUrl? }`.
- [ ] Google login only authenticates after `/users/me` succeeds.
- [ ] Stored token restore calls `/users/me` before rendering protected UI.
- [ ] Stored token uses `sessionStorage`, not `localStorage`.
- [ ] Expired/rejected tokens are cleared.
- [ ] Forbidden users see a visible forbidden state.
- [ ] GIS/FedCM failures do not leave a blank route.
- [ ] Fake auth still works.
- [ ] No backend sessions, cookies, refresh-token storage, service worker token
      manager, or auth event bus introduced.
- [ ] Final auth ADR created from the corrected PRD, tech design, session notes,
      and implemented code.

## Open Decisions To Reconfirm Before Coding

These are low-risk but worth confirming if implementation reveals friction:

- Whether visible auth fallback strings should be added to all i18n locale JSON
  files immediately.
- Whether `avatarUrl` should be rendered in `UserMenu` now. Current plan is no:
  keep it in the authenticated user shape but do not add avatar UI in this slice.

Resolved during planning:

- `docs/specs/v1-tech-design.md` was updated from `localStorage` to
  `sessionStorage`.
