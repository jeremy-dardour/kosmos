# V1 Technical Design

How V1 is built. Links the decisions made across schema, API, state machine,
auth, and deployment into one implementation reference.

For **what** V1 does and **why**, see the
[V1 Product PRD](./v1-product/PRD.md). For the domain glossary, see
[CONTEXT.md](../../CONTEXT.md).

---

## Architecture

### Monorepo structure

```
apps/
  api/          → NestJS REST API (MikroORM 7 + Postgres)
  web/          → React SPA (Vite + openapi-react-query)
packages/
  api-contracts/  → OpenAPI-generated TypeScript types
  eslint-config/  → Shared ESLint flat config
  shared/         → Shared utilities
  typescript-config/ → Shared tsconfig presets
```

### Single deployable

One Docker container serves both the API and the Vite-built SPA
(`ServeStaticModule`). One origin, no CORS, one deploy target.

### Module layout

```
src/modules/
  workstream/              ← owns the entire aggregate
    workstream.module.ts
    workstream.controller.ts    (Workstream CRUD + advance)
    workstream.service.ts       (pipeline transitions + CRUD)
    step.controller.ts          (Step CRUD + reorder)
    step.service.ts             (position management, mutability enforcement)
    note.controller.ts
    note.service.ts             (author-guarded edit/delete)
    checklist-item.controller.ts
    checklist-item.service.ts
    utils/                      (pure derivation functions)
    dtos/
      input/                    (class-validator)
      output/                   (@ApiProperty)
  project/                 ← thin CRUD
  group/                   ← thin CRUD
  user/                    ← upsert-on-login, read-only endpoints
```

Full layout rationale: [module-layout.md](../module-layout.md).

---

## Data model

Seven entities, one Postgres enum. Full column specs, constraints, cascades, and
indexes in [entity-schema-design.md](../entity-schema-design.md).

```
Project ──1:N──→ Workstream ──1:N──→ Step ──1:N──→ ChecklistItem
    │                │                  │
    │                │                  └──1:N──→ Note
    │                │
    └──1:N──→ Group ←──N:1── Workstream (optional)

User ←── Workstream.ownerId (optional)
User ←── Step.ownerId (optional, inherits if null)
User ←── Note.authorId
Workstream.currentStepId ──→ Step (nullable circular FK, RESTRICT)
```

**Key schema decisions:**

- **Step positions:** 1-indexed integers with `UNIQUE (workstream_id, position)
DEFERRABLE INITIALLY DEFERRED` — allows bulk position reassignment within a
  transaction.
- **Circular FK (`currentStepId`):** `ON DELETE RESTRICT` prevents deleting the
  current step. Mutations are UPDATEs, not DELETEs — no flush-ordering concern.
- **No stored status enums:** Workstream lifecycle is derived from
  `(startedAt, completedAt)`. Step status is derived from position vs pointer.
  See [ADR 0005](../adr/0005-workstream-pipeline-state-machine.md).
- **Cascades:** Project → Workstream/Group (CASCADE), Workstream → Step
  (CASCADE), Step → ChecklistItem/Note (CASCADE), Group/User → SET NULL on
  optional FKs.
- **Same-parent integrity (service-layer):** Two constraints that can't be
  expressed as simple FKs without composite keys (unsupported by MikroORM's
  metadata pipeline): (1) `Workstream.groupId` must reference a Group in the
  same Project, (2) `Workstream.currentStepId` must reference a Step belonging
  to that Workstream. Both are enforced as guards in `WorkstreamService`.

---

## State machine

The pipeline state machine is the core of the domain. Full specification in
[ADR 0005](../adr/0005-workstream-pipeline-state-machine.md). Implementation
implementation decisions resolved in session 10.

### Lifecycle (derived, never stored)

| `startedAt` | `completedAt` | `currentStepId` | Lifecycle      |
| :---------: | :-----------: | :-------------: | -------------- |
|    null     |     null      |      null       | **NotStarted** |
|     set     |     null      |       set       | **Active**     |
|     set     |      set      |      null       | **Complete**   |

### Transitions

One API endpoint: `POST /workstreams/:id/advance`. The server dispatches by
lifecycle:

| Current state           | Behavior                                            | Outcome param                |
| ----------------------- | --------------------------------------------------- | ---------------------------- |
| NotStarted              | Sets `startedAt`, points to first step              | Must not be provided (400)   |
| Active                  | Records outcome on current step, moves pointer      | Optional, defaults to `done` |
| Active (last step)      | Records outcome, sets `completedAt`, clears pointer | Optional, defaults to `done` |
| Complete                | 409 `workstream-not-advanceable`                    | —                            |
| NotStarted + zero steps | 409 `workstream-empty`                              | —                            |

Internally, `WorkstreamService` dispatches to private `start()` and
`advanceActive()` methods — distinct transitions with different invariants,
behind a unified API surface.

### Implementation decisions

- **Service structure:** All pipeline logic as private methods on
  `WorkstreamService`. No separate state-machine class.
- **Derived state:** Pure utility functions in `workstream/utils/`:
  `deriveLifecycle()`, `deriveStepStatus()`, `resolveOwner()`,
  `deriveNearestDeadline()`. Used by both mutations and DTO construction.
- **Transactions:** Explicit `em.transactional()` for `advance` and step
  reorder only. All other operations rely on MikroORM's unit-of-work flush.
- **Validation:** Guards at the top of service methods. Wrong lifecycle → 409.
  Outcome on NotStarted → 400 (DTO validation).

---

## API contract

Full endpoint spec, DTOs, and error codes in the
[API contract PRD](./api-contract/PRD.md).

### Design principles

1. **One overview call** — `GET /projects/:id/overview` returns the full tree
   (project + groups + workstreams + steps + checklist items + users). At 20–50
   workstreams this is a few KB.
2. **Named RPC for pipeline action** — `POST /workstreams/:id/advance`. Not
   PATCH — the pointer logic is too specific for a generic field update.
3. **Derived state in responses** — lifecycle, step status, owner inheritance,
   nearest deadline — all computed server-side.
4. **Flat CRUD for sub-entities** — Steps, Notes, ChecklistItems have their own
   endpoints scoped under their parent.
5. **No pagination** — client-side filters at this data volume.

### Step mutability

| Zone    | Structure (add/delete/reorder) | Attributes (name, deadline, owner, blocked) |    Notes    |
| ------- | :----------------------------: | :-----------------------------------------: | :---------: |
| Past    |             Frozen             |                   Frozen                    | Append only |
| Current |             Frozen             |                  Editable                   |     Yes     |
| Future  |            Editable            |                  Editable                   |     Yes     |

Enforcement: `StepService` loads the parent workstream, compares position vs
pointer. Violations → 409 `step-frozen` or `step-not-deletable`.

### Error responses

| Status | When                                    | Type slug                    |
| ------ | --------------------------------------- | ---------------------------- |
| 409    | `advance` on Complete                   | `workstream-not-advanceable` |
| 409    | `advance` on empty workstream           | `workstream-empty`           |
| 400    | `advance` with outcome on NotStarted    | validation error             |
| 409    | Mutation on past step                   | `step-frozen`                |
| 409    | Structural mutation on current step     | `step-not-deletable`         |
| 409    | Reorder list doesn't match future steps | `reorder-mismatch`           |
| 403    | Edit/delete note by non-author          | `not-note-author`            |

---

## Auth

Full implementation spec in the [Auth PRD](./auth/PRD.md). Research in
[auth-internals.md](../research/auth-internals.md).

> **Web module structure:** see
> [ADR 0007](../adr/0007-web-auth-module-boundaries.md) — where `/users/me`
> lives, why page load restores rather than prompts, why only `401`
> invalidates a session, and the fake-auth-stays-offline constraint. It
> supersedes the "Frontend login flow" steps below, which describe `login()`
> as the mount-time entry point.

- **Identity:** Google Identity Services (GIS) — `openid`, `email`, `profile`
  scopes. Consent screen published "In production" (non-sensitive scopes, no
  verification needed).
- **Access control:** Static `.env` allow-list (`AUTH_ALLOWED_EMAILS`). No
  in-app user management.
- **API:** OIDC/JWT validation pipeline (already wired in template). Adapt
  payload schema for Google ID token shape. User upsert on first login.
- **Web:** `GoogleAuthProvider` via GIS JS SDK, env-driven selection vs
  `FakeAuth`.
- **Dev/test:** `FakeAuth` path remains fully functional. All auth env vars
  optional when `FAKE_AUTH=true`.

### Auth validation and restore follow-up

The Google auth wiring remains stateless: the API does not create a server-side
session and the web app does not receive refresh tokens. The web app may persist
the short-lived Google ID token in `sessionStorage` so a same-tab browser
refresh can restore the user until the token expires.

The web app must not treat a raw GIS credential as an authenticated app session.
The backend remains the source of truth for both token validity and
`AUTH_ALLOWED_EMAILS`.

#### API current-user endpoint

Add `GET /api/users/me`.

The route is protected by the normal API auth guard. The guard verifies the
Google ID token, checks the static allow-list, provisions/updates the `User`, and
attaches the authenticated user to the request. The controller returns that
server-trusted user as `CurrentUserDto`.

Response:

```ts
interface CurrentUserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}
```

No database schema change is required.

Expected status semantics:

- `200`: token is valid, email is allow-listed, user has been
  provisioned/updated, and the response body is the current app user.
- `401`: token is missing, malformed, expired, or rejected by Google/JWT
  validation.
- `403`: token is valid but the email is not in `AUTH_ALLOWED_EMAILS`.

#### Frontend login flow

`GoogleAuthProvider.login()` should remain the single entry point used by
`ProtectedRoute`.

1. If another login/restore is already in flight, return the existing promise.
2. Check `sessionStorage` for the stored Google ID token.
3. If a token exists and is not locally expired, call `GET /api/users/me` with
   `Authorization: Bearer <token>`.
4. If `/me` succeeds, set `AuthenticatedUser` from the response and resolve
   without showing the Google prompt.
5. If the stored token is missing, expired, rejected with `401`, or rejected with
   `403`, clear storage and continue to the Google prompt path.
6. Load/initialize GIS lazily.
7. Prompt the user with GIS.
8. When GIS returns a credential, store the ID token temporarily and call
   `GET /api/users/me`.
9. If `/me` succeeds, keep the stored token, set `AuthenticatedUser` from the
   response, and resolve login.
10. If `/me` fails with `401` or `403`, clear the stored token and reject with an
    auth-specific error that the UI can render.
11. If GIS/FedCM cannot produce a credential, show an explicit sign-in/error
    fallback instead of leaving the protected route blank.

The frontend may decode the ID token only to read `exp` for a local expiry
pre-check. Rendered identity fields (`id`, `email`, `name`, `avatarUrl`) must
come from `/api/users/me`, not from decoded Google claims.

#### Frontend refresh flow

On page refresh, the app starts with no in-memory user. `ProtectedRoute` calls
`auth.login()` as it does today.

- If `sessionStorage` contains a non-expired ID token and `/api/users/me`
  succeeds, the provider restores the authenticated user without prompting
  Google.
- If no token exists, the provider prompts Google.
- If the token exists but is expired or rejected, the provider clears it and
  prompts Google.
- If the token is valid but the email is forbidden, the provider clears it and
  renders the forbidden state.

This gives refresh persistence without introducing backend sessions.

#### Rationale

`GET /api/users/me` is needed because Google sign-in only proves that the
browser received a Google credential. It does not prove that the account is
authorized for this app. The backend owns the allow-list, token verification,
and user provisioning rules, so the frontend must validate the credential
against the API before rendering protected app content.

The endpoint is a current-user endpoint rather than a session endpoint. It
returns the app user that the backend has accepted for the current bearer token.
This keeps the architecture stateless and matches the existing API auth guard:
each request carries its own proof, and the API validates that proof without
server-side session lookup.

Persisting the Google ID token in `sessionStorage` is the smallest fix for
same-tab browser refresh. The current in-memory provider loses state on reload,
which causes a fresh Google prompt even when the token is still valid. Storing
the short-lived ID token lets the provider retry `/api/users/me` after reload
and restore the user without adding backend session storage. `sessionStorage`
keeps the persistence scoped to the current tab and avoids sharing the token
across same-origin tabs. The app still clears the token on logout, expiry,
`401`, or `403`.

Refresh tokens are intentionally not stored in the browser or backend for this
app. The product has a tiny private user set and does not need long-lived Google
API access. Keeping only the ID token limits the auth surface area: the app can
restore across a same-tab browser refresh during the token lifetime, and after
expiry it asks Google again.

User display data must come from `/api/users/me` instead of client-decoded
Google claims. The backend may normalize names, store avatar URLs, or update the
user record during provisioning. Rendering the server response keeps the UI
aligned with the app's own user model and fixes name/avatar drift.

Explicit auth UI states are needed because GIS and FedCM can fail without
returning a credential, especially in private browsing or with browser account
state disabled. A protected route that only waits for a successful callback can
land on a blank page. Rendering `checking`, `sign-in`, `forbidden`, and `error`
states makes those failures recoverable and testable.

#### Logout flow

Logout clears the in-memory user and removes the stored Google ID token from
`sessionStorage`. It may also call GIS disable/revoke behavior if supported, but
the app must not depend on that call for its own logged-out state.

#### Auth UI states

`ProtectedRoute` must represent these states explicitly:

- `checking`: restore/login validation is in flight.
- `sign-in`: no local token exists, local token is expired, or GIS prompt is
  required.
- `authenticated`: `/api/users/me` succeeded.
- `forbidden`: `/api/users/me` returned `403`.
- `error`: GIS/FedCM failed or validation failed unexpectedly.

The route should not render a blank page for GIS/FedCM failures.

#### Testing requirements

- API e2e: `/api/users/me` returns the current user for a valid allow-listed
  Google token.
- API e2e: `/api/users/me` returns `403` for a valid token whose email is not
  allow-listed.
- API e2e: `/api/users/me` returns `401` without a valid token.
- Web unit tests: login stores the credential only after GIS returns it and marks
  authenticated only after `/me` succeeds.
- Web unit tests: refresh restores from `sessionStorage` through `/me`.
- Web unit tests: expired/rejected tokens are cleared.
- Web unit tests: forbidden and GIS/FedCM failure states are renderable.

This closes four gaps in the first auth pass:

- disallowed Google accounts can no longer enter the app before the backend
  allow-list check runs;
- display name/avatar come from the backend-provisioned user instead of
  client-side token decoding;
- browser refresh no longer loses auth state while the ID token remains valid;
- Google/FedCM prompt failures render an explicit sign-in/error fallback instead
  of a blank protected route.

---

## Deployment

Hosting research in [hosting-deploy.md](../research/hosting-deploy.md).

| Concern    | Decision                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| App host   | Google Cloud Run (scale-to-zero, free tier)                                       |
| Database   | Neon (managed Postgres, free tier, connection pooling)                            |
| Frontend   | Single deployable — SPA served from same container                                |
| CD         | GitHub Actions → GHCR → `gcloud run deploy`                                       |
| Migrations | At container start ([ADR 0001](../adr/0001-migrations-run-on-container-start.md)) |
| Secrets    | Cloud Run env vars / Secret Manager                                               |
| TLS        | Cloud Run automatic HTTPS + custom domain                                         |
| Cost       | ~$0/mo steady state                                                               |

---

## Build sequence

11 GitHub issues. End-to-end slices — each produces a visible, testable result
(backend + frontend together). Auth and deployment are independent technical
tracks.

### End-to-end slices (sequential)

| #   | Issue                                                                                                | Scope                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0   | [#17 — Entities + migration](https://github.com/jeremy-dardour/wedding-planner/issues/17)            | All MikroORM entities, initial migration (foundation)                                                   |
| 1   | [#18 — Layout shell + overview + cards](https://github.com/jeremy-dardour/wedding-planner/issues/18) | Overview endpoint + two-panel layout + grouped cards with pipeline dots + UI foundation (design tokens) |
| 2   | [#19 — Detail slide-over (read-only)](https://github.com/jeremy-dardour/wedding-planner/issues/19)   | Notes read endpoint + detail panel with step pipeline, checklist, notes                                 |
| 3   | [#20 — Advance + start](https://github.com/jeremy-dardour/wedding-planner/issues/20)                 | Unified advance endpoint + card buttons + blocked resolve                                               |
| 4   | [#21 — Deadline badges + filters](https://github.com/jeremy-dardour/wedding-planner/issues/21)       | Countdown badges, urgency thresholds, owner/group filter dropdowns (frontend only)                      |
| 5   | [#22 — Notes write actions](https://github.com/jeremy-dardour/wedding-planner/issues/22)             | Note CRUD endpoints (author-guarded) + add/edit/delete in detail panel                                  |
| 6   | [#23 — Checklist + step edits](https://github.com/jeremy-dardour/wedding-planner/issues/23)          | Step + checklist CRUD endpoints + mutability enforcement + toggles + inline editing                     |
| 7   | [#24 — Workstream + group management](https://github.com/jeremy-dardour/wedding-planner/issues/24)   | Create/edit/delete workstreams and groups from UI                                                       |

### Technical (independent)

| #   | Issue                                                                                                        | Scope                                                         | Blocking?                  |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------- |
| 8   | [#25 — Auth: Google OAuth](https://github.com/jeremy-dardour/wedding-planner/issues/25)                      | GIS wiring, allow-list, user upsert                           | Required before production |
| 9   | [#30 — Auth: backend-validated session restore](https://github.com/jeremy-dardour/wedding-planner/issues/30) | `/api/users/me`, local ID-token restore, explicit auth states | Required before production |
| 10  | [#26 — Deployment: Cloud Run + Neon](https://github.com/jeremy-dardour/wedding-planner/issues/26)            | Infra, CD pipeline, custom domain                             | Non-blocking               |

### Dependency graph

```
#17 → #18 → #19 → #22 (notes write)
        │      └──→ #23 (checklist + step edits)
        ├──→ #20 (advance)
        ├──→ #21 (badges + filters)
        └──→ #24 (workstream management)

#25 → #30 (independent — FakeAuth covers dev)
#26 (independent — can land anytime)
```

---

## Open decisions (deferred to implementation)

- **Workstream icon representation** — emoji string vs named icon set. The
  `icon` field is `varchar(255)` and accepts either. Visual refinement during
  UI slices.
- **i18n language** — English-first (`en` primary, `fr` secondary). Template
  has i18n wired; translation is a polish pass, not a blocker.

---

## ADR index

| ADR                                                      | Decision                                      |
| -------------------------------------------------------- | --------------------------------------------- |
| [0001](../adr/0001-migrations-run-on-container-start.md) | Migrations run at container start             |
| [0002](../adr/0002-dual-validation-stack.md)             | Dual validation stack (zod + class-validator) |
| [0003](../adr/0003-trust-proxy.md)                       | Trust proxy                                   |
| [0004](../adr/0004-eslint-layered-flat-configs.md)       | ESLint layered flat configs                   |
| [0005](../adr/0005-workstream-pipeline-state-machine.md) | Workstream pipeline state machine             |
