# Auth research: Google identity + allow-list options

Research for wayfinder ticket 02 (auth). Feeds the decision in ticket 05; this
doc does not decide, it lays out the ground truth. 2–6 users, all personal
Gmail accounts (no Google Workspace domain), solo dev, cost-sensitive.

## 1. Existing auth mechanism in the codebase

The template ships a generic **OIDC/JWT bearer-token** setup: the API never
talks to the identity provider (IdP) directly for login — it only validates
JWTs a client already obtained, against the IdP's published JWKS. There is no
session, no cookie, no server-side OAuth callback in the API today.

**API side** (`apps/api/src/app/auth/`):

- `strategies/jwt/oidc-discovery.service.ts` — `OidcDiscoveryService.init()`
  runs once at bootstrap. It calls `oidc.discovery(discoveryUrl, clientId, undefined, oidc.None(), …)`
  from the `openid-client` package against `AUTH_OIDC_DISCOVERY_URL`
  (`env.schema.ts`), pulls `issuer` and `jwks_uri` out of the returned server
  metadata, and builds a `jose.createRemoteJWKSet` from `jwks_uri`. `oidc.None()`
  means it authenticates as a **public client** — no client secret is used or
  needed, because the service only ever verifies tokens, it never exchanges a
  code for one.
- `auth-initializer.service.ts` — calls `OidcDiscoveryService.init()` at app
  startup, unless `shouldUseMockAuth()` is true (see below), in which case it
  logs a warning and skips discovery entirely.
- `strategies/jwt/jwt-verification.service.ts` — `JwtVerificationService.verify(token)`
  calls `jose.jwtVerify(token, jwks, { issuer, audience })`. `audience` is
  hardcoded as `` `api://${AUTH_CLIENT_ID}` `` — **this is a Microsoft
  Entra ID (Azure AD) convention**, not a generic OIDC one; it does not match
  what Google puts in `aud` (see §2). The verified payload is parsed against
  `jwtPayloadSchema` (`schemas/jwt-payload.schemas.ts`), then
  `validateScopes()` checks the token's `scp` claim (space-separated, also an
  Entra/Microsoft-Identity-platform convention) against `AUTH_ACCEPTED_SCOPES`
  from env. Google ID tokens carry neither `api://`-prefixed audiences nor a
  `scp` claim — both need adapting for a Google-only setup (§2 covers this).
- `strategies/jwt/jwt-auth.strategy.ts` — `JwtAuthStrategy.authenticate()`
  extracts the `Bearer` token from the `Authorization` header and delegates to
  `JwtVerificationService`.
- `strategies/mock-auth.strategy.ts` — `MockAuthStrategy.authenticate()`
  ignores the request entirely and returns a hardcoded
  `{ email: 'mock@example.com', name: 'MockUser', … }` payload. No token
  parsing at all.
- `auth.guard.ts` — `AuthGuard` picks `mockAuthStrategy` vs `jwtAuthStrategy`
  once, in its constructor, based on `shouldUseMockAuth(configService)`. Every
  request (unless the handler/class carries the `@Public()` decorator) is
  routed through whichever strategy was chosen at boot; the guard itself knows
  nothing about OIDC.
- `utils/should-use-mock-auth.util.ts` — mock auth is used iff
  `FAKE_AUTH=true` **and** `NODE_ENV !== 'production'`. This is a hard
  safety rail: mock auth cannot silently activate in prod through
  misconfiguration of `FAKE_AUTH` alone.
- `types/token.types.ts` / `schemas/jwt-payload.schemas.ts` — the validated
  shape is `{ sub, email?, name?, preferred_username?, scp?, roles?, iat?, exp?, nbf?, iss?, aud? }`.
  `AuthenticatedUser` (what lands on `request.user`) only keeps
  `email/name/preferred_username/roles`.

**Web side** (`apps/web/src/auth/`):

- `auth-provider.interface.ts` — the seam: any real provider must implement
  `initialize()`, `login()`, `logout()`, `isAuthenticated()`,
  `getAuthenticatedUser()`, `getAccessToken(): Promise<string>`. Nothing
  Google- or MSAL-specific leaks past this interface.
- `fake-auth-provider.ts` — `FakeAuthProvider` is the only implementation that
  exists today. It fakes a logged-in `dev.user@example.com`, and
  `getAccessToken()` calls `generateFakeJwt()` (`utils/generate-fake-jwt.ts`)
  to mint an **unsigned-in-any-real-sense** JWT (HS256 header, base64url
  payload, and a signature segment that is literally the string
  `'fake-signature-for-dev'` base64url-encoded — no key, no crypto). This only
  works against the API when the API is also in mock-auth mode, since the real
  `JwtVerificationService` would reject it outright (wrong `iss`, unverifiable
  signature).
- `create-auth-provider.ts` — currently _always_ returns a `FakeAuthProvider`
  regardless of environment; this is the seam where a real provider
  (Google-backed) gets wired in later. No env-driven branching exists yet on
  the web side (contrast with the API's `shouldUseMockAuth`).
- `types.ts` — the web app's own `AuthenticatedUser` shape (`{ username, name? }`)
  is intentionally smaller than the API's and unrelated to the JWT payload
  shape; also defines `AuthEvent` (`LOGIN_SUCCESS` / `LOGOUT_SUCCESS`) for
  cross-tab/cross-component messaging, consumed by `auth-context.tsx`.

**E2E test mocks** (`apps/api/src/__e2e-tests__/`):

- `mocks/mock-oidc.service.ts` — `MockOidcService` generates a real RS256
  keypair with `jose.generateKeyPair`, and exposes `getIssuer()` returning the
  fixed string `https://auth.example.com/`. This is injected in place of
  `OidcDiscoveryService` via `overrideProvider` in
  `helpers/create-app.helper.ts`, so e2e tests exercise the _real_
  `JwtVerificationService` cryptographic path against a locally-generated key
  rather than a network call.
- `helpers/mock-token.factory.ts` — `MockTokenFactory` signs real JWTs with
  that keypair (`jose.SignJWT`) with sensible defaults
  (`sub`, `email`, `name`, `preferred_username`, `scp`, `aud`, `iss`) and
  helpers for the unhappy paths the API needs to reject:
  `expiredToken()`, `wrongScopeToken()`, `wrongAudienceToken()`,
  `wrongIssuerToken()`. This is the template's existing playbook for testing
  auth without hitting a real IdP — swapping the IdP later (Google) doesn't
  change this pattern, only the specific claim values the factory defaults to.
- `auth.e2e-spec.ts` exercises the guard end-to-end using the factory above.

**Net read:** the template is IdP-agnostic by design — everything downstream
of "we received a valid, signed JWT with certain claims" is already built.
Swapping in Google means: (a) getting a Google-signed ID token onto the
client, (b) pointing `OidcDiscoveryService` at Google's metadata, and
(c) reconciling the two Microsoft-shaped assumptions baked into
`JwtVerificationService` — the `api://` audience prefix and the `scp` scope
claim — which do not exist in Google ID tokens.

## 2. Google OAuth options

Both paths below validate the token the **same way** on the backend — Google
signs all ID tokens (GIS-issued or full-OIDC-issued) with the same keys,
published at the same JWKS URL
(`https://www.googleapis.com/oauth2/v3/certs`, reachable via discovery). The
real difference between the two paths is **how the browser obtains the
token**, not how the API validates it.

Google's ID token claims (both paths, same shape): `iss` (`https://accounts.google.com`
or `accounts.google.com`), `aud` (your OAuth client ID, _no_ `api://` prefix),
`sub`, `email`, `email_verified`, `name`, `picture`, `hd` (Workspace hosted
domain, absent for personal Gmail), `iat`, `exp`. No `scp` / scope claim.
([Google OIDC reference](https://developers.google.com/identity/openid-connect/openid-connect))

|                                            | **1. Google Identity Services (GIS)**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **2. Google as full OIDC provider**                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **How the browser gets a token**           | Load Google's GSI JS library, render "Sign in with Google" button (or One Tap). Google's SDK handles the whole exchange in-browser via FedCM/postMessage — no redirect to a Google-hosted consent page under your control, no code exchange in your app. The credential callback hands you a raw Google-signed ID token directly. ([Verify Google ID token](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token), [FedCM migration](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)) | Standard OIDC Authorization Code + PKCE redirect: app redirects to Google's `authorization_endpoint`, user consents, Google redirects back with a code, app (or a lightweight backend) exchanges it at the `token_endpoint` for an ID token. Needs an OIDC client library (e.g. `oidc-client-ts`) on the web side since none exists in the repo today — `openid-client` (already a dependency) is Node-only. |
| **Where the token goes**                   | Web app POSTs the raw ID token to the API in the `Authorization: Bearer` header, same as today's `FakeAuthProvider.getAccessToken()` contract.                                                                                                                                                                                                                                                                                                                                                                                       | Same — the API's `AuthGuard` → `JwtAuthStrategy` → `JwtVerificationService` pipeline is unchanged either way.                                                                                                                                                                                                                                                                                                |
| **API-side discovery config**              | `AUTH_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration` — `OidcDiscoveryService` works unmodified; Google publishes a standard discovery document. ([Google discovery doc](https://developers.google.com/identity/openid-connect/openid-connect))                                                                                                                                                                                                                                                     | Same discovery URL, same `OidcDiscoveryService` code path. No difference from GIS on this axis.                                                                                                                                                                                                                                                                                                              |
| **Code changes needed regardless of path** | `JwtVerificationService.audience` must drop the `api://` prefix — Google's `aud` is the bare client ID (`jwt-verification.service.ts:30`). `validateScopes()` / `AUTH_ACCEPTED_SCOPES` must be removed or made optional — Google ID tokens carry no `scp` claim, so scope checking as currently written always fails against Google. `jwtPayloadSchema` should add `email_verified`, `hd`, `picture` if you want them; `sub`/`email`/`aud`/`iss` already fit.                                                                        | Same two fixes apply — they are IdP-shape issues, not path-specific.                                                                                                                                                                                                                                                                                                                                         |
| **Web-side implementation**                | A `GoogleAuthProvider implements AuthProvider`, using GIS's JS SDK for `login()`/credential capture, `google.accounts.id.disableAutoSelect()` or similar for `logout()` (Google has no true server-side session to end — GIS/FedCM sign-out is client-local only). Small: one script tag + one client-side library (`@react-oauth/google` is a common thin wrapper, or hand-roll against the vanilla GSI JS API).                                                                                                                    | A `GoogleAuthProvider` wrapping a redirect-flow OIDC client (`oidc-client-ts` or similar), handling redirect callback routing, token storage/refresh. More moving parts: callback route, silent-renew/refresh-token handling, PKCE code-verifier storage. Google's web client registration for pure SPA PKCE (no client secret) works but is more fiddly to set up correctly than GIS's drop-in button.      |
| **Dev/local mock story**                   | Unaffected — `FakeAuthProvider` + `MockAuthStrategy` continue to work exactly as today for local dev/e2e; nothing about GIS requires touching the mock path. Real Google sign-in only needs testing against a live Google project (or skipped locally).                                                                                                                                                                                                                                                                              | Same — mock path is orthogonal to which real-auth path you pick.                                                                                                                                                                                                                                                                                                                                             |
| **Logout semantics**                       | No real single-sign-out; "logout" just clears local app state (matches `FakeAuthProvider.logout()` today, which just flips a boolean) and optionally calls GIS's client-side "disable auto-select" to stop One Tap re-prompting.                                                                                                                                                                                                                                                                                                     | Same limitation — Google does not provide a clean RP-initiated logout endpoint the way some enterprise IdPs do.                                                                                                                                                                                                                                                                                              |
| **Overall trade-off**                      | Fewer moving parts, no OIDC-client library to add to the web app, first-party "Sign in with Google" UX users already recognize, less code to write and maintain for 2–6 users. Ties you to Google's proprietary JS SDK (not a portable OIDC redirect flow) if the domain model's "IdP-agnostic" ambition ever mattered in practice — it likely doesn't for a 2-person tool.                                                                                                                                                          | Reuses the _concept_ the template already has wired for Microsoft (redirect-based OIDC), and is the more "generic/portable" choice, but there's no existing OIDC redirect client in the web app to reuse — you'd be adding one from scratch, more code, more edge cases (PKCE, refresh, callback routing), for zero practical benefit at this user count.                                                    |

**Recommendation lean for this axis:** GIS is materially less code for identical
backend validation and identical dev-mock story; the "portability" argument
for the full-OIDC path doesn't pay for itself at 2–6 users. (Not a final
decision — ticket 05.)

## 3. Allow-list mechanisms

The decisive question for each: **can a new helper be added without a
redeploy and without Google Cloud Console access?**

### 3a. Google OAuth consent-screen "Testing" allow-list

Google Cloud OAuth consent screens have a **publishing status**: `Testing` or
`In production`. In `Testing`, only emails explicitly added as **test users**
in the Console can complete sign-in; everyone else is rejected before your
app ever sees them ([Manage app audience](https://support.google.com/cloud/answer/15549945?hl=en)).

- **Hard cap: 100 test users**, cannot be raised without formal Google
  verification. Irrelevant at 2–6 users but worth knowing.
- **Test-user authorizations expire after 7 days**, forcing re-consent —
  annoying for a tool meant to be used casually over months
  ([Unipile: 100 user limit](https://www.unipile.com/google-oauth-100-user-limit/)).
- **Viable for a "production-deployed" app?** Technically yes — nothing stops
  you running the real app while the Console project stays in `Testing`
  status. But the 7-day re-consent and the visible "Google hasn't verified
  this app" warning screen make it feel unpolished for actual daily use by
  non-technical helpers.
- **Adding a user:** done in Console → OAuth consent screen → Audience → add
  email → Save. **No redeploy needed** — but it _does_ require Google Cloud
  Console access, which the task's decisive question rules out as a
  qualifying answer.
- **Important wrinkle discovered in research:** the unverified-app warning
  and the 100-user/7-day constraints are specifically properties of
  `Testing` status. If the app requests only **non-sensitive scopes**
  (`openid`, `email`, `profile` — exactly what's needed here), Google allows
  publishing to **`In production` without formal verification**
  ([sensitive-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)).
  In `In production` status, the test-user list **stops functioning as a
  gate at all** — any Google account can obtain a valid ID token. This means
  mechanism 3a is really only usable as a real allow-list while deliberately
  staying in `Testing`; moving to `In production` (to shed the 7-day expiry
  and warning screen) requires falling back to mechanism 3b or 3c for access
  control, since Google itself no longer restricts who can authenticate.

### 3b. Google Group / Cloud Identity Groups API membership check

Idea: maintain a group of allowed emails; API calls Google's API on login to
check membership, so adding a helper is "add them to the group," no redeploy.

- **Cloud Identity Groups API** (`docs.cloud.google.com/identity/docs/groups`)
  only manages/queries **"Groups for Business"** — i.e. groups created under
  a Cloud Identity or Workspace **organization domain**. Personal Gmail
  accounts have no such organization, so there is nothing to attach this API
  to.
- **Transitive membership check** (`checkTransitiveMembership`, the API call
  you'd actually want — "is user X in group Y") is gated further: **only
  available to Workspace Enterprise Standard/Plus/Education or Cloud Identity
  Premium** accounts. A personal/free setup gets a `403 PERMISSION_DENIED`
  ([Querying group memberships](https://docs.cloud.google.com/identity/docs/how-to/query-memberships)).
- **Directory API** (`groups.list`/`members.list`) is likewise **Workspace
  Admin SDK only** — requires a Workspace super-admin identity and domain,
  neither of which exists for a personal-Gmail-only setup
  ([Directory API group members guide](https://developers.google.com/workspace/admin/directory/v1/guides/manage-group-members)).
- **Consumer Google Groups** (the free `groups.google.com` product personal
  accounts _can_ create) have **no public API at all** for programmatic
  membership queries — management is Console/web-UI only, and even reading a
  group's roster requires being a group owner/manager in the web UI, with no
  documented REST surface for a backend to call.
- **Conclusion: not viable.** This mechanism requires infrastructure (a
  Workspace or Cloud Identity Premium subscription) this project doesn't
  have and isn't going to buy for 2–6 users. Adding a Workspace subscription
  just to unlock this API would itself be a bigger cost/complexity addition
  than the problem it solves.

### 3c. Static `.env` allow-list

A comma-separated env var (e.g. `AUTH_ALLOWED_EMAILS=a@gmail.com,b@gmail.com`),
checked against the verified token's `email` claim at login time — this is
the mechanism the domain model already names as the V1 fallback
([decision 26](../domain-decisions.md), and referenced in `CONTEXT.md` §
Key Rules → Access control).

- **Composes cleanly with "User created on first login":** the allow-list
  check sits _before_ the `User` upsert — reject unknown emails at the
  `AuthGuard`/strategy layer (a natural new step alongside
  `JwtVerificationService.validateScopes()`, replacing it, in
  `jwt-verification.service.ts`) so no `User` row is ever created for a
  rejected email. This is a small, fully self-contained addition to code
  that already exists.
- **Adding a user without redeploy:** **No.** This requires either (a)
  changing the env var and restarting/redeploying the API process (exact
  mechanics depend on the hosting choice from ticket 03 — e.g. a Fly.io/Render
  env var update usually triggers a restart but not necessarily a full
  redeploy), or (b) moving the list out of `.env` into a DB table seeded at
  first boot, which is no longer "static `.env`" but a small schema addition
  (a natural place for it: a trivial `AllowedEmail` table, editable via a
  future minimal admin action or direct DB access) — decisive answer per the
  task's own framing: **requires redeploy or an env-var update + restart.**

### Comparison table

| Mechanism                                    | New helper added without Console access? | New helper added without redeploy/restart?                                           | Viable at 2–6 personal-Gmail users?                                                          |
| -------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 3a. OAuth consent-screen test-user list      | No (Console-only)                        | Yes, but only while in `Testing` status (7-day token expiry, unverified-app warning) | Yes, with UX caveats; stops gating entirely once published `In production`                   |
| 3b. Google Group / Cloud Identity Groups API | N/A — mechanism itself unusable          | N/A                                                                                  | **No** — requires Workspace/Cloud Identity Premium, which personal Gmail accounts don't have |
| 3c. Static `.env` allow-list                 | Yes (no Console involvement at all)      | No — needs env change + restart, or a DB-backed variant                              | Yes — simplest, most predictable, already named in the domain decisions                      |

## 4. Recommendation candidates (ranked, not decided)

Not a final call — that's ticket 05 — but ranked by practicality for this
project's actual shape (2–6 known personal Gmail users, solo dev, cost-sensitive,
values low operational fuss over portability):

1. **GIS (§2 path 1) + static `.env`/DB allow-list (§3c), consent screen
   published `In production` with only non-sensitive scopes.** Least code
   (no OIDC redirect client needed on the web side), no ongoing Console
   babysitting once published, no 7-day re-consent nagging existing helpers,
   allow-list check is a small addition to code that already exists
   (`jwt-verification.service.ts`), and the domain model already names this
   allow-list shape as the intended V1 fallback.
2. **GIS (§2 path 1) + consent-screen test-user list (§3a), left in
   `Testing`.** Zero new code beyond the GIS integration itself — adding a
   helper is a two-click Console action. Worse UX (7-day expiry means
   helpers periodically get logged out and must re-consent; unverified-app
   warning looks unpolished) and requires the dev to have Console access at
   the moment a new helper needs adding, which is fine solo but is a
   process dependency mechanism 3c doesn't have.
3. **Full OIDC redirect (§2 path 2) + either allow-list.** Same allow-list
   trade-offs as options 1/2 above, but adds an OIDC redirect client
   (PKCE, callback routing, token refresh) to the web app for no benefit at
   this scale — the "generic IdP" portability the template's shape suggests
   doesn't pay for itself with exactly one IdP (Google) ever in scope.
4. **Google Group / Cloud Identity Groups API allow-list (§3b), any auth
   path.** Ruled out — infrastructure this project doesn't have and has no
   reason to acquire.

## Sources

- [Google OIDC / OpenID Connect reference](https://developers.google.com/identity/openid-connect/openid-connect)
- [Verify the Google ID token on your server side](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)
- [Authenticate with a backend server (GIS)](https://developers.google.com/identity/sign-in/web/backend-auth)
- [Migrate to FedCM](https://developers.google.com/identity/gsi/web/guides/fedcm-migration)
- [Manage App Audience (Testing vs In production, test-user cap)](https://support.google.com/cloud/answer/15549945?hl=en)
- [Google OAuth 100 User Limit explainer](https://www.unipile.com/google-oauth-100-user-limit/)
- [Unverified apps](https://support.google.com/cloud/answer/7454865?hl=en)
- [When is verification not needed](https://support.google.com/cloud/answer/13464323?hl=en)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Cloud Identity Groups API overview](https://docs.cloud.google.com/identity/docs/groups)
- [Querying group memberships (Cloud Identity, Premium-only)](https://docs.cloud.google.com/identity/docs/how-to/query-memberships)
- [Directory API: Group Members (Workspace Admin SDK)](https://developers.google.com/workspace/admin/directory/v1/guides/manage-group-members)

## Files read

- `apps/api/src/app/auth/auth.guard.ts`
- `apps/api/src/app/auth/auth-initializer.service.ts`
- `apps/api/src/app/auth/strategies/jwt/jwt-auth.strategy.ts`
- `apps/api/src/app/auth/strategies/jwt/jwt-verification.service.ts`
- `apps/api/src/app/auth/strategies/jwt/oidc-discovery.service.ts`
- `apps/api/src/app/auth/strategies/mock-auth.strategy.ts`
- `apps/api/src/app/auth/schemas/jwt-payload.schemas.ts`
- `apps/api/src/app/auth/types/token.types.ts`
- `apps/api/src/app/auth/utils/should-use-mock-auth.util.ts`
- `apps/api/src/app/config/env.schema.ts`
- `apps/api/src/__e2e-tests__/mocks/mock-oidc.service.ts`
- `apps/api/src/__e2e-tests__/helpers/mock-token.factory.ts`
- `apps/api/src/__e2e-tests__/helpers/create-app.helper.ts`
- `apps/web/src/auth/auth-provider.interface.ts`
- `apps/web/src/auth/fake-auth-provider.ts`
- `apps/web/src/auth/create-auth-provider.ts`
- `apps/web/src/auth/types.ts`
- `apps/web/src/auth/utils/generate-fake-jwt.ts`
