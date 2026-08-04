# Multi-Tenancy — Technical Design

Status: agreed (D1–D4 resolved 2026-08-03)

How the [multi-tenancy PRD](./PRD.md) is built. Sibling of the
[V1 tech design](../v1-tech-design.md); this doc covers only what tenancy
changes. The [V1 API contract](../v1-product/api-contract.md) gets amended at
implementation time (OpenAPI stays the live contract).

---

## Starting point (what the code already gives us)

- **Routes are already half project-scoped.** Creation/ordering routes carry
  `/projects/:projectId/…`; mutations of existing resources are flat
  (`/workstreams/:id`, `/steps/:id`, `/groups/:id`, `/notes/:id`,
  `/checklist-items/:id`) and resolve by bare UUID with no project or actor
  predicate — these are the tenancy leak points.
- **The web is already plumbed for a project id.** `useOverview(projectId)`
  passes it everywhere; the only single-project assumption is
  `projects.data?.[0]?.id` in `overview-page.tsx` and the absence of routes.
- **One authorization precedent exists**: the note-author check
  (`note.service.ts` `assertAuthor`, actor threaded from the controller via
  `AuthUserProvisionerService.provision`).
- **The global user pool leaks**: `overview.repository.ts` does
  `em.find(User, {})` — every user in the DB appears in every overview.
- **No membership model**: `Project` has no owner; `User` has no project
  relation; `GET /projects` returns all rows unscoped.
- The `.env` allow-list (`AUTH_ALLOWED_EMAILS`) is the only access gate and
  **stays unchanged** (PRD decision 2).

## Two gates, clearly separated

1. **App gate (unchanged):** the allow-list decides who can authenticate at
   all. Enforced in `JwtVerificationService`, as today.
2. **Project gate (new):** membership decides which projects an authenticated
   user can see and touch. Enforced inside the `project` module (see
   §Authorization).

---

## Data model

### New entity: `ProjectMember`

| Column      | Type           | Constraints / Notes                                            |
| ----------- | -------------- | -------------------------------------------------------------- |
| `id`        | `uuid`         | PK, `defaultRaw: gen_random_uuid()`                            |
| `projectId` | `uuid`         | FK → Project. `ON DELETE CASCADE`.                             |
| `email`     | `varchar(255)` | Normalized lowercase. The invitation key.                      |
| `userId`    | `uuid`         | Nullable. FK → User, `ON DELETE SET NULL`. Null = **pending**. |
| `createdAt` | `timestamptz`  | `defaultRaw: now()`                                            |
| `updatedAt` | `timestamptz`  | `defaultRaw: now()`                                            |

Constraints/indexes:

- `UNIQUE (project_id, email)` — one membership per email per project.
- Index on `email` (attach-on-login lookup), index on `user_id` (project-list
  query). Adding a member uses an atomic upsert on the unique key per the
  persistence standard.

A membership is **pending** while `userId` is null and **joined** once it
points at a User. Pending members never appear in owner pickers or the
overview users directory; they appear only in the members management list.

### `Project` gains an owner and a soft-delete marker

| Column      | Type          | Constraints / Notes                             |
| ----------- | ------------- | ----------------------------------------------- |
| `ownerId`   | `uuid`        | FK → User. `ON DELETE RESTRICT`. NOT NULL.      |
| `deletedAt` | `timestamptz` | Nullable. Set = soft-deleted (PRD decision 14). |

**Decision (D2):** the owner is a plain FK on Project, **and** the owner
always has a joined `ProjectMember` row (invariant maintained by the service:
create-project writes both; transfer updates `ownerId` only; remove-member
refuses the owner's row). "Who can access project P" is then answered by
member rows alone — no OR-owner special case in any query. The rejected
alternative — a `role` enum on `ProjectMember` with a partial unique index
for the single owner — spreads the invariant across rows and buys nothing at
two permission levels.

No other entity changes. `User` stays global (PRD decision 5).

---

## Authorization

### Membership enforcement — repository-scoped (D1)

**Decision: fold the membership predicate into repository loads; a
non-member gets a 404, never a 403.** Guards keep doing authentication only —
object-level authorization lives at the data seam, not the HTTP rim.

Every repository fetch that backs a flat `/{resource}/{id}` route (and the
project-scoped routes' root resolution) adds an actor predicate: _the resource
belongs to a **non-deleted** project that has a joined member row for this
user_. Soft-deleted projects are invisible to every content read and write —
including the owner's; the only operations that see a deleted project are the
owner's project list (flagged rows) and `restore`. In MikroORM
terms the criteria walks the existing FK chain (`checklist-item → step →
workstream → project`, etc.) into a members subquery. A miss throws MikroORM's
`NotFoundError` → the existing filter maps it to **404** — non-members can't
distinguish "doesn't exist" from "not yours", so project existence never
leaks. The predicate lives as one em-parameterized helper in
`repositories/membership.query.ts` (ADR 0008 pattern) reused by every
repository, keeping enforcement inside the persistence seam rather than
sprinkled across service methods where a missed call is silent.

- Repository signatures change from `findDetails(id)` to
  `findDetails(id, actorUserId)` — mechanical, and the compiler finds every
  call site.
- The overview repository scopes its project load and its users directory the
  same way.
- Locked aggregate-root loads (advance, structural edits, reorder) add the
  predicate to the root resolution they already perform; children are then
  trusted via the root as today.

Rejected alternatives: a global NestJS guard can't check membership without
importing project-module repositories (forbidden — `app/` can't import
business modules) and can't know the project for flat routes without its own
DB walk; a module-scoped guard duplicates every resource→project load, is
per-route opt-in (fail-open on omission), and has a TOCTOU gap between check
and load; MikroORM global filters make the predicate invisible at review time
and invert the forgetting problem (internal flows must remember to _disable_
them); per-service-method assertions are the "remember to call it 25 times"
pattern the repository seam avoids; Postgres RLS is hand-written SQL policy
machinery MikroORM doesn't manage, disproportionate for one persistence seam.

**Rule (recorded here, enforced in review): no handler side effects before
the actor-scoped root load.** The data-layer boundary protects data; it
cannot protect an outbound call made before the resource is resolved. Thin
controllers + services whose first act is the scoped root resolution keep
this true; the app has no outbound side effects today (no email, PRD 9).

### Owner-only operations — explicit 403

Governance operations (member add/remove, transfer, project delete) act on a
project the actor **can** see, so hiding is wrong; they assert
`project.ownerId === actorId` in `ProjectService` and throw 403
`not-project-owner` otherwise. This mirrors the existing note-author 403.

### Owner-assignment validation tightens

Assigning a workstream/step owner currently checks the user exists globally.
It now checks the target is a **joined member of the same project** → 422
`owner-not-member` otherwise. (Same-parent integrity in the service layer,
per ADR 0006.)

### Actor resolution

Every mutating endpoint now needs the persisted actor's User id. Per the auth
PRD, the global guard stays read-only and provisioning stays in `/users/me` —
so actor resolution becomes a **read-only lookup**: a small
`ActorResolutionService` (in `app/auth`, replacing the note controller's
per-call `provision()` usage) resolves `request.user.email` → persisted User
via the existing user repository. The web always establishes a session
through `/users/me` first, so the row exists; a miss is a 401 (stale
session). Controllers keep the current `@Req()` pattern — no new decorator;
param decorators can't await a DB lookup anyway.

### Attach-on-login

`/users/me` provisioning gains one step, in the same transaction as the user
upsert: claim all pending memberships for the normalized email
(`UPDATE project_member SET user_id = :id WHERE email = :email AND user_id IS
NULL`). Idempotent, concurrent-safe (plain UPDATE), and the only place
pending → joined happens.

Constraints for later tickets (from the T-1 security review):

- **Unlink ≠ revoke.** The claim runs on every login, so a member row with
  `user = null` and a matching email is always (re)claimable. Membership
  removal must **delete** the row; unsetting `user` would be silently undone
  at the target's next login.
- **`set null` on user deletion reopens the claim.** If a User row is ever
  deleted, `deleteRule: 'set null'` reverts their memberships to
  pending-by-email — a recycled (Workspace) address then inherits them at
  first login. When user deletion becomes a feature, delete member rows
  instead (re-invite is cheap; silent inheritance is not).
- **`ProjectMember.email` lowercase is seam-enforced, not DB-enforced.**
  `upsertProfile` normalizes; the invite endpoint must lowercase before
  writing, and the T-2 migration should add a check constraint
  (`email = lower(email)`) so a mixed-case row can't dodge the claim or
  duplicate under the case-sensitive `(project, email)` unique.

---

## API changes

### Changed behavior

| Endpoint                     | Change                                                                                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /projects`              | Returns only the actor's projects (joined member rows), ordered by `createdAt`: non-deleted ones for members, plus the actor's **own deleted** projects (flagged via `deletedAt`) for the trash section. |
| `POST /projects`             | Actor becomes owner + joined member (one transaction). Enforces the owned-projects cap.                                                                                                                  |
| `PATCH /projects/:id`        | Any member (PRD: settings are content).                                                                                                                                                                  |
| `GET /projects/:id/overview` | 404 for non-members; `users` directory = joined members only.                                                                                                                                            |
| All existing flat mutations  | Membership-scoped via repositories (404 for non-members). No path changes.                                                                                                                               |
| `GET /users/me`              | Also claims pending memberships (attach-on-login).                                                                                                                                                       |

### New endpoints

| Method   | Path                               | Body               | Response      | Rule                                                                                             |
| -------- | ---------------------------------- | ------------------ | ------------- | ------------------------------------------------------------------------------------------------ |
| `DELETE` | `/projects/:id`                    | —                  | `204`         | Owner only. **Soft delete**: sets `deletedAt`; no cascade. Members lose access instantly.        |
| `POST`   | `/projects/:id/restore`            | —                  | `ProjectDto`  | Owner only; the one write that targets a deleted project. 409 `project-not-deleted` if it isn't. |
| `GET`    | `/projects/:id/members`            | —                  | `MemberDto[]` | Any member. Includes pending rows.                                                               |
| `POST`   | `/projects/:id/members`            | `AddMemberDto`     | `MemberDto`   | Owner only. Upsert by `(project, email)`; cap enforced.                                          |
| `DELETE` | `/projects/:id/members/:memberId`  | —                  | `204`         | Owner, **or** the member removing their own row (= leave). Owner's row: 409 always.              |
| `POST`   | `/projects/:id/transfer-ownership` | `TransferOwnerDto` | `ProjectDto`  | Owner only. Target must be a joined member.                                                      |

Leave-project is `DELETE …/members/:memberId` on your own row — one route,
one rule, instead of a parallel `/members/me`.

### DTOs

```ts
class AddMemberDto {
  email!: string; // @IsEmail, normalized lowercase server-side
}

class TransferOwnerDto {
  memberId!: string; // @IsUUID — a joined member row of this project
}

class MemberDto {
  id!: string; // member row id
  email!: string;
  userId?: string | null; // null = pending
  name?: string | null; // from the joined User; null while pending
  avatarUrl?: string | null;
  isOwner!: boolean; // derived: user_id === project.owner_id
  createdAt!: string;
}
```

`ProjectDto` gains `ownerId!: string` and `deletedAt?: string | null`. The
project list reuses `ProjectDto`
(the client derives "mine" by comparing `ownerId` with the session user id) —
no separate list-item DTO per the one-DTO-per-entity standard.

### New error slugs

| Status | When                                                | `type` slug                  |
| ------ | --------------------------------------------------- | ---------------------------- |
| 404    | Any access to a project the actor isn't a member of | (MikroORM `NotFoundError`)   |
| 403    | Governance operation by a non-owner member          | `not-project-owner`          |
| 409    | Removing the owner's member row / owner leaving     | `cannot-remove-owner`        |
| 409    | Transfer target is not a joined member              | `transfer-target-not-member` |
| 409    | Adding an email that is already a member            | `duplicate-member`           |
| 409    | 21st owned non-deleted project                      | `project-limit-reached`      |
| 409    | `restore` on a project that isn't deleted           | `project-not-deleted`        |
| 409    | 21st member row (joined + pending) on a project     | `member-limit-reached`       |
| 422    | Workstream/step owner not a joined project member   | `owner-not-member`           |

Caps are constants (20/20, PRD decision 10), checked in the service inside
the same transaction as the insert (count under the project lock — the
existing order-callback locking idiom already locks the project row).

---

## Migration

**Decision (D3): schema-only — there is no legacy data to preserve.** The app
has never been deployed (#26 is still pending), and local databases are
recreated from the seeder. So:

- One migration creates `project_member` (+ unique constraint and indexes)
  and adds `project.owner_id` as **NOT NULL from the start** (`ON DELETE
RESTRICT`). No nullable-then-backfill phase, no data migration, no
  owner-selection env var.
- Existing local databases won't satisfy the new NOT NULL column — the
  documented path is drop + `db:migrate:up` + `db:seed:local`, which is
  already routine locally.
- The **dev seeder** assigns the owner and member rows for its fixture users.
  It reads `SEED_OWNER_EMAIL` from env (untracked `.env`) with a committed
  placeholder default, so a developer's real email can drive local testing
  without ever being committed (repo may become public — see CLAUDE.md
  Visibility).
- The PRD's original "transition without loss" goal and migration decision
  are superseded by this (PRD amended accordingly).

---

## Web changes

### Routing

```
/                        → ProjectListPage        (always the landing, PRD 11)
/projects/:projectId     → OverviewPage           (deep-linkable)
```

`ProtectedRoute` wraps the layout as today. `OverviewPage` reads
`projectId` from route params — deleting the `projects.data?.[0]?.id` line.
A 404 from the overview query (non-member or deleted) renders a "project not
found" state with a link back to `/`.

### New feature folder: `features/projects/`

- `project-list-page.tsx` — cards (name, event date countdown, owner badge),
  empty state → create dialog, plus a collapsed **Deleted** section (owner's
  soft-deleted projects: name + deleted date + Restore — not openable). Uses
  the existing `FormDialog`.
- `create-project-dialog.tsx` — name + optional event date.
- `members-dialog.tsx` — member list (avatar/name, or email + "pending"
  badge), owner-only add/remove/transfer controls, self-remove ("leave") for
  non-owners. Opened from the overview header; replaces nothing (the existing
  `ProjectSettingsDialog` keeps name/eventDate).

### Hooks (`src/api/hooks/`)

New: `use-create-project`, `use-delete-project`, `use-restore-project`,
`use-project-members`, `use-add-member`, `use-remove-member`,
`use-transfer-ownership`.
Changed: `use-projects` (semantics: "my projects").

All are **dialog mutations** → they invalidate (`useInvalidateOverview` +
the projects list / members queries). None of this goes through the
overview-cache seam — membership changes are not patchable aggregate edits.

### Session/identity

No auth changes. `useAuthState()` already exposes the session user id for
owner-badge and "am I the owner" derivations. Owner-gated controls are
hidden (not disabled) for non-owners; the API re-enforces regardless.

---

## Testing

- **API e2e:** the decisive layer for tenancy. Fixtures: two users, two
  projects, cross-membership. For **every** route: non-member → 404;
  member content mutations → 200; governance by member → 403; owner flows
  (add/remove/transfer/leave/caps/pending-attach) → per contract. The
  existing e2e auth helpers already mint per-email tokens.
- **Web integration (MSW):** project list journeys (list → open → overview),
  members dialog flows, non-member 404 state, owner-gated control visibility.
- **Unit:** membership predicate helper, attach-on-login claim, cap checks.

---

## Build sequence

Four vertical slices, each an end-to-end increment with a visible result
(confirmed 2026-08-04). Strictly sequential — each depends on the previous.

| #   | Issue                                                              | Scope                                                                                                                                                                   |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-1 | [#53](https://github.com/jeremy-dardour/wedding-planner/issues/53) | Walking skeleton: entities + migration + seeder + attach-on-login, scoped `GET/POST /projects`, actor resolution, `/` list + `/projects/:id` routes, create dialog      |
| T-2 | [#54](https://github.com/jeremy-dardour/wedding-planner/issues/54) | Enforcement everywhere: membership predicate in every repository, member-scoped users directory, `owner-not-member`, full non-member-404 e2e sweep, web not-found state |
| T-3 | [#55](https://github.com/jeremy-dardour/wedding-planner/issues/55) | Members management: members endpoints + caps/duplicates, pending badge, members dialog, leave                                                                           |
| T-4 | [#56](https://github.com/jeremy-dardour/wedding-planner/issues/56) | Governance: transfer ownership, soft delete + restore, settings danger zone, Deleted list section                                                                       |

```
PR #52 (widget panel — merged 2026-08-04; prerequisite satisfied)
   ↓
#53 (T-1) → #54 (T-2) → #55 (T-3) → #56 (T-4)
```

No independent technical track: actor resolution and the membership query
fragment land inside T-1/T-2 where first needed. T-2 is the security
boundary — it lands before any UI advertises multi-project beyond the
scoped list.

---

## Resolved decisions (2026-08-03)

| #   | Decision                                               | Resolution                                                                               |
| --- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| D1  | Membership enforcement seam and non-member status code | Repository-scoped predicate only → 404; guards stay authn-only                           |
| D2  | Owner representation                                   | `Project.ownerId` FK + owner always has a joined member row                              |
| D3  | Migration of existing data                             | None — schema-only migration; app pre-deployment, dev DBs reseeded                       |
| D4  | Web URL shape                                          | `/` list + `/projects/:projectId` overview                                               |
| D5  | Project deletion semantics (2026-08-04)                | Soft delete + restore-only trash, no purge; delete UI in the settings dialog danger zone |
