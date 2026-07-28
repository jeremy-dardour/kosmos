# Auth Implementation: GIS + Email Allow-List

Status: ready-for-agent

## Decision

Google Identity Services (GIS) on the web, Google-signed ID tokens validated by
the existing OIDC/JWT pipeline on the API, email allow-list in `.env` for access
control. Consent screen published "In production" with non-sensitive scopes only
(`openid`, `email`, `profile`) — no verification needed, no 7-day token expiry,
no "unverified app" warning.

Rationale and alternatives evaluated in
[docs/research/auth-internals.md](../../research/auth-internals.md) (ticket 02).

---

## Scope

Wire real Google authentication end-to-end while keeping the existing
`FakeAuth`/mock path fully functional for local dev and e2e tests.

### In scope

- API: adapt JWT verification for Google ID tokens, add email allow-list gate,
  upsert User on first login.
- Web: implement `GoogleAuthProvider` using GIS JS SDK, wire env-driven provider
  selection in `createAuthProvider`.
- E2e tests: update mock token factory claims to match Google shape.
- Env config: new/changed env vars for both apps.

### Out of scope

- Roles or permissions (V1: all users equal).
- Refresh tokens or silent renewal (GIS ID tokens are short-lived; re-prompt on
  expiry is acceptable for 2-6 users).
- Database-backed allow-list (`.env` is sufficient for V1; seam exists to move
  it to DB later).

---

## API changes (`apps/api/`)

### 1. Env schema (`src/app/config/env.schema.ts`)

| Var                       | Change     | Value                                                                   |
| ------------------------- | ---------- | ----------------------------------------------------------------------- |
| `AUTH_OIDC_DISCOVERY_URL` | Keep as-is | `https://accounts.google.com/.well-known/openid-configuration`          |
| `AUTH_CLIENT_ID`          | Keep as-is | The Google OAuth client ID (bare, no `api://` prefix)                   |
| `AUTH_ACCEPTED_SCOPES`    | **Remove** | Google ID tokens have no `scp` claim                                    |
| `AUTH_ALLOWED_EMAILS`     | **Add**    | Comma-separated list of allowed emails (e.g. `a@gmail.com,b@gmail.com`) |
| `FAKE_AUTH`               | Keep as-is | Unchanged behavior                                                      |

`AUTH_ALLOWED_EMAILS` schema: `z.string().transform(v => v.split(',').map(e => e.trim().toLowerCase())).refine(v => v.length > 0 && v.every(e => e.includes('@')))`.

Make `AUTH_ALLOWED_EMAILS` **optional when `FAKE_AUTH=true`** (not needed in
mock mode). Make `AUTH_CLIENT_ID` and `AUTH_OIDC_DISCOVERY_URL` also optional
when `FAKE_AUTH=true` (they already aren't used, but currently fail validation
if absent).

### 2. JWT payload schema (`src/app/auth/schemas/jwt-payload.schemas.ts`)

Adapt to Google's ID token shape:

```ts
export const jwtPayloadSchema = z.object({
  sub: z.string(),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
  hd: z.string().optional(),
  iat: z.number().optional(),
  exp: z.number().optional(),
  iss: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
});
```

Removed: `preferred_username`, `scp`, `roles`, `nbf` (not in Google ID tokens).
Added: `email_verified`, `picture`, `hd`.

### 3. JWT verification (`src/app/auth/strategies/jwt/jwt-verification.service.ts`)

Two changes:

**a) Audience** — drop the `api://` prefix (line 30):

```ts
// Before
this.audience = `api://${this.configService.get('AUTH_CLIENT_ID')}`;
// After
this.audience = this.configService.get('AUTH_CLIENT_ID');
```

**b) Scopes** — remove `validateScopes()` entirely. Delete the method, remove
the `acceptedScopes` field, remove the call in `verify()`. Google ID tokens
carry no `scp` claim; scope validation is meaningless.

### 4. Email allow-list check

Add an `AllowListService` (or inline in `JwtVerificationService`) that:

1. Reads `AUTH_ALLOWED_EMAILS` from config (already parsed to `string[]`).
2. After successful JWT verification, checks
   `allowedEmails.includes(payload.email.toLowerCase())`.
3. If not allowed: throw a new `ForbiddenEmailException` (403, not 401 — the
   token is valid, the user is just not permitted).

**Where it lives:** in `JwtVerificationService.verify()`, after the JWT is
cryptographically verified and the payload parsed — replaces the old
`validateScopes()` call site. This keeps the single responsibility: "is this
token valid AND is this user allowed?"

Edge case: if `email` is missing from the token or `email_verified` is false,
reject (same 403).

### 5. AuthenticatedUser type (`src/app/auth/types/token.types.ts`)

Update to match Google claims:

```ts
export interface AuthenticatedUser {
  email: string; // was optional, now required (allow-list guarantees it)
  name?: string;
  avatarUrl?: string; // from Google's `picture` claim
}
```

Remove: `preferred_username`, `roles` (not in Google tokens, not used in V1).

The mapping from JWT payload to `AuthenticatedUser` happens in `JwtAuthStrategy`
(currently `jwt-auth.strategy.ts`): map `picture` → `avatarUrl`.

### 6. User upsert on login

`GET /users/me` is the session-establishment boundary. After the global auth
guard validates the token and allow-list, this endpoint atomically upserts the
User by normalized email and returns the server-trusted profile. Concurrent
first-login requests must resolve to the same User row.

The global auth guard is read-only: it verifies credentials and attaches the
trusted token identity to the request, but performs no database writes. Other
authenticated endpoints therefore cannot provision or refresh a User as a side
effect.

Name and avatar are refreshed by `/users/me`, matching the web flow that
validates every new or restored credential through that endpoint before exposing
an authenticated session. A future endpoint that needs a persisted actor should
use an explicit persisted-user resolution seam rather than reintroducing
provisioning into the global guard.

### 7. Cleanup

- Delete `InsufficientScopesException` (no longer used after scope removal).
- Remove `AUTH_ACCEPTED_SCOPES` from `.env.example` / `.env.test` / docs.

---

## Web changes (`apps/web/`)

> **Implementation note:** the web design below is the original delivery plan.
> [ADR 0007](../../adr/0007-web-auth-module-boundaries.md) supersedes its
> `AuthProvider`, imperative login, provider-selection, and One Tap details. The
> shipped module uses `AuthSystem`, `AuthSession`, and the official GIS rendered
> button as its only Google acquisition path.

### 1. Env config

Add to web env (Vite: `VITE_` prefix):

| Var                     | Purpose                                                        |
| ----------------------- | -------------------------------------------------------------- |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID                                         |
| `VITE_FAKE_AUTH`        | `"true"` to use `FakeAuthProvider` locally (default `"false"`) |

### 2. GoogleAuthProvider

New file: `src/auth/google-auth-provider.ts`, implementing `AuthProvider`.

Uses the GIS JS SDK (`google.accounts.id`):

- **`initialize()`**: load the GSI script tag, call `google.accounts.id.initialize({ client_id, callback })`. The callback receives a `CredentialResponse` with the raw ID token in `credential`.
- **`login()`**: call `google.accounts.id.prompt()` (One Tap) or render/click the
  Sign In button. Store the returned `credential` (the ID token string) in
  memory (not localStorage — it's short-lived).
- **`logout()`**: clear local state, call `google.accounts.id.disableAutoSelect()`.
  No server-side session to end.
- **`isAuthenticated()`**: return whether a non-expired token is held.
- **`getAuthenticatedUser()`**: decode the ID token payload (base64, no
  verification needed client-side — the API verifies) and return
  `{ username: email, name }`.
- **`getAccessToken()`**: return the stored ID token string. The API receives it
  as a `Bearer` token, same as `FakeAuthProvider` today.

**Library choice:** use the vanilla GSI JS API directly (one `<script>` tag),
or `@react-oauth/google` as a thin React wrapper. Either is fine — the
`AuthProvider` interface isolates it.

### 3. Provider selection (`src/auth/create-auth-provider.ts`)

```ts
export function createAuthProvider(): AuthProvider {
  if (import.meta.env.VITE_FAKE_AUTH === 'true') {
    const provider = new FakeAuthProvider();
    provider.initialize();
    return provider;
  }
  const provider = new GoogleAuthProvider();
  provider.initialize();
  return provider;
}
```

### 4. Token expiry handling

Google ID tokens expire after ~1 hour. When `getAccessToken()` detects the token
is expired (decode `exp`, compare to `Date.now()`), either:

- Return a rejected promise so the API layer can catch the 401 and trigger
  `login()` again (re-prompt), or
- Proactively call `google.accounts.id.prompt()` to get a fresh token.

For V1 with 2-6 users, the simplest path (catch 401 → re-prompt) is sufficient.

---

## E2e test changes (`apps/api/src/__e2e-tests__/`)

### Mock token factory (`helpers/mock-token.factory.ts`)

Update default claims to match Google ID token shape:

- `aud`: bare client ID (no `api://` prefix).
- `iss`: `https://accounts.google.com` (or whatever the mock OIDC service returns).
- Add `email_verified: true`, `picture: 'https://example.com/avatar.jpg'`.
- Remove `scp` and `preferred_username` from defaults.
- Update unhappy-path helpers: remove `wrongScopeToken()`, keep
  `wrongAudienceToken()` and `wrongIssuerToken()`.
- Add `disallowedEmailToken()` — valid JWT but email not in the allow-list.

### Auth e2e spec (`__e2e-tests__/auth.e2e-spec.ts`)

- Remove scope-related test cases.
- Add: "rejects valid token with email not in allow-list" (403).
- Add: "rejects token with `email_verified: false`" (403).
- Existing token validation tests (expired, wrong issuer, wrong audience, bad
  signature) should still pass with updated claim shapes.

### Test env

Provide `AUTH_ALLOWED_EMAILS` in the e2e test setup (via
`create-app.helper.ts` or test `.env`), containing the mock user's email.

---

## Google Cloud Console setup (manual, not code)

1. Create an OAuth 2.0 client ID (type: Web application) in the Google Cloud
   Console.
2. Set authorized JavaScript origins: the production URL + `http://localhost:5173`
   (Vite dev server, for testing real Google auth locally if desired).
3. Request scopes: `openid`, `email`, `profile` only (non-sensitive — no
   verification required).
4. Publish the consent screen to "In production" status.
5. Note the client ID — it goes into `AUTH_CLIENT_ID` (API) and
   `VITE_GOOGLE_CLIENT_ID` (web).

---

## Env var summary

### API (`.env`)

```
AUTH_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
AUTH_CLIENT_ID=<google-oauth-client-id>
AUTH_ALLOWED_EMAILS=user1@gmail.com,user2@gmail.com
FAKE_AUTH=false
```

### Web (`.env`)

```
VITE_GOOGLE_CLIENT_ID=<google-oauth-client-id>
VITE_FAKE_AUTH=false
```

### Local dev (`.env` or `.env.local`)

```
FAKE_AUTH=true
VITE_FAKE_AUTH=true
# AUTH_CLIENT_ID, AUTH_OIDC_DISCOVERY_URL, AUTH_ALLOWED_EMAILS not needed
```

---

## Files touched (expected)

### API — modify

- `src/app/config/env.schema.ts` — add `AUTH_ALLOWED_EMAILS`, remove `AUTH_ACCEPTED_SCOPES`, make auth vars optional when `FAKE_AUTH=true`
- `src/app/auth/strategies/jwt/jwt-verification.service.ts` — drop `api://` prefix, remove `validateScopes`, add allow-list check
- `src/app/auth/schemas/jwt-payload.schemas.ts` — Google claim shape
- `src/app/auth/types/token.types.ts` — update `AuthenticatedUser`
- `src/app/auth/strategies/jwt/jwt-auth.strategy.ts` — map `picture` → `avatarUrl`
- `src/__e2e-tests__/helpers/mock-token.factory.ts` — Google-shaped claims
- `src/__e2e-tests__/auth.e2e-spec.ts` — new test cases, remove scope tests

### API — delete

- `src/app/auth/exceptions/insufficient-scopes.exception.ts`

### API — create

- `src/app/auth/exceptions/forbidden-email.exception.ts` (if not inlined)

### Web — modify

- `src/auth/create-auth-provider.ts` — env-driven provider selection

### Web — create

- `src/auth/google-auth-provider.ts` — GIS-backed `AuthProvider` implementation

---

## Acceptance criteria

1. With `FAKE_AUTH=true`, both apps behave exactly as today (no regression).
2. With real Google config, a user in the allow-list can sign in via Google,
   hit authenticated API endpoints, and sees their name/avatar.
3. A Google user NOT in the allow-list gets a 403 on any authenticated endpoint.
4. A token with `email_verified: false` gets a 403.
5. E2e tests pass with Google-shaped claims (no scope tests, new allow-list tests).
6. No `AUTH_ACCEPTED_SCOPES` env var anywhere.
7. User entity is created/updated on first authenticated API call.
