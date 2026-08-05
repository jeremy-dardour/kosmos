# Multi-Tenancy T-3 + T-4 — Implementation Plan

Status: agreed (decisions resolved 2026-08-04, review-amended same day) —
building on `feat/multi-tenancy-t3-t4`

Covers [T-3 #55](https://github.com/jeremy-dardour/kosmos/issues/55) (members
management) and [T-4 #56](https://github.com/jeremy-dardour/kosmos/issues/56)
(transfer ownership + soft delete/restore). Both tickets ship from this one
branch; each ticket closes with its own full review battery. Point-in-time
record — delete once both tickets are merged and the tech design is amended.

## Starting point

T-2 ([PR #61](https://github.com/jeremy-dardour/kosmos/pull/61)) is **merged**;
the branch sits clean at main's tip. Several things the tickets list as
prerequisites already exist:

- `project_member` table with `UNIQUE (project_id, email)`, indexes on
  `email`/`user_id`, and the `email = lower(email)` check constraint
  (`Migration20260804131403`). **No new schema migration is needed** for
  T-3/T-4.
- `Project.owner` (NOT NULL, `deleteRule: 'restrict'`) and
  `Project.deletedAt`; `ProjectDto` already exposes `ownerId` and `deletedAt`.
- `ProjectRepository.findAllForUser` already returns the owner's soft-deleted
  projects (`$or` branch) — the T-4 Deleted section is pure frontend plus the
  delete/restore endpoints.
- Tenancy plumbing: `projectVisibleTo` / `assertProjectVisible`
  (`membership.query.ts`), globally bound `CurrentUserInterceptor`,
  `@CurrentUser()`, the tenancy e2e sweep with its coverage meta-test.
- Attach-on-login claim in `UserRepository.upsertProfile` (same transaction as
  the user upsert).
- Web: `ProjectListPage` with owner badge (currently filters out deleted
  rows), `create-project-dialog.tsx` with the inline-slug error pattern,
  `ConfirmDialog`, `ProjectNotFound`, `useInvalidateOverview`.

`findOneForUser` uses `projectVisibleTo`, which excludes soft-deleted projects
**even for the owner** — restore needs a distinct repository resolution (see
Phase 4).

## Decisions resolved (2026-08-04, to be recorded as tech-design D6–D8)

| #   | Decision                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6  | Restore re-checks the owned-project cap in-transaction → 409 `project-limit-reached`. Caps stay **best-effort** accident bounds (see rules below)        |
| D7  | Member cap is env `MAX_PROJECT_MEMBERS` (default `'20'`), mirroring `MAX_OWNED_PROJECTS`; amends "caps are constants"                                    |
| D8  | Transfer-ownership does **not** check the target's owned-project cap. PRD cap wording amended: the cap gates creating and restoring, not total ownership |
| —   | Both tickets ship from one branch/PR stream; a full review battery closes each ticket                                                                    |

## Transactional governance rules (review amendment, 2026-08-04)

1. **Governance authorization is checked under the project lock.** Every
   governance mutation (add member, remove member, transfer, delete, restore)
   is one transaction that pessimistic-write-locks the project row, then
   re-reads and re-validates on the locked row: project live/deleted as the
   operation requires, actor still the owner, target membership still in the
   necessary state. No mutation trusts a pre-lock read.
2. **Duplicate membership wins over the member cap.** Under the lock, the
   existing-`(project, email)` check runs before the cap count: adding an
   already-present email always yields `duplicate-member`, even at capacity.
3. **Restore refreshes state after acquiring the lock** — `deletedAt` and
   ownership are re-checked on the locked row, so two concurrent restores of
   the same project cannot both succeed.
4. **Ownership caps are best-effort, not strictly serialized.** The
   owned-project count is taken without an owner-wide lock — two concurrent
   restores of _different_ projects can transiently exceed the cap, exactly
   as concurrent creates already can (`createOwned`'s deliberately unlocked
   count, T-1). Recorded in D6; no User-row locking.
5. **Repository signatures carry the actor.** Per D1 (enforcement at the
   persistence seam), member/governance repository methods take
   `currentUserId` and embed the visibility predicate themselves rather than
   relying on a caller-side assert. The order-callback idiom stays: the
   repository owns lock + transaction + loads; the service-supplied callback
   decides and throws the Problem-Details exception so the transaction rolls
   back (rejected alternative: discriminated-outcome returns, which would
   move business limits into persistence).
6. **The tenancy sweep gains a third actor.** Fixture: owner, joined
   non-owner member, non-member. `RouteCase` gets explicit `ownerStatus`,
   `memberStatus` (the non-owner member), and `deletedOwnerStatus`
   (default 404; restore overrides) axes — without this, governance-route
   403 expectations would be exercised against the owner and test nothing.

---

## Phase 1 — T-3 backend: members endpoints

### Config

- `MAX_PROJECT_MEMBERS` in `app/config/env.schema.ts` (default `'20'`) +
  `.env.example` entry.

### DTOs

- `modules/project/dtos/input/add-member.dto.ts` — `email` with `@IsEmail` +
  `@ApiProperty` (normalized lowercase server-side, not in the DTO).
- `modules/project/dtos/output/member.dto.ts` — `MemberDto`:

  ```ts
  id!: string;                 // member row id
  email!: string;
  userId?: string | null;      // null = pending
  name?: string | null;        // from the joined User; null while pending
  avatarUrl?: string | null;
  isOwner!: boolean;           // derived: userId === project.ownerId
  createdAt!: string;
  ```

  Colocated `toMemberDto(member, ownerId)` mapper, matching the
  `toProjectDto` convention.

### Errors

- New `modules/project/utils/forbidden.util.ts` — `forbidden(typeSlug,
detail)` → 403 `ProblemDetailsException`, sibling of `conflict.util.ts`.
  Used for `not-project-owner` here and in T-4.

### Repository

New `modules/project/repositories/member.repository.ts`, registered in
`project.module.ts` providers. Actor in every signature (rule 5):

- `findMembers(projectId, currentUserId)` — visibility predicate embedded
  (miss → `NotFoundError` → 404); member rows with populated `user`, ordered
  `createdAt asc`.
- `addMember(projectId, currentUserId, email, cb)` — `em.transactional`:
  lock the project row (visible-scoped, same shape as
  `lock-project-order.query.ts`), then **on the locked row** load: project
  (owner id), any existing `(project, email)` row, the member count
  (joined + pending), and the `User` for the email. Callback receives all of
  it and throws (403 non-owner → `not-project-owner`; existing row →
  `duplicate-member` **before** count ≥ cap → `member-limit-reached`);
  repository inserts, attaching `user` immediately when the User exists.
- `removeMember(projectId, currentUserId, memberId, cb)` — same locked
  transaction shape; loads project + target member row; callback decides
  (404 wrong project / 409 `cannot-remove-owner` first / owner-or-self rule /
  403); repository **hard deletes** the row. Never unset `user`: the
  attach-on-login claim runs on every login, so an unlinked row with a
  matching email would be silently re-claimed (T-1 security-review
  constraint).

### Service + controller

New `member.service.ts` + `member.controller.ts`
(`@Controller('projects/:projectId/members')`), keeping
`project.controller.ts` focused. Swagger decorators per the existing
controller conventions (`@ApiBearerAuth`, `@ApiCommonErrorResponses`, etc.).

| Route               | Rules (evaluated in order, under the project lock for mutations)                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /`             | visibility-scoped load (non-member or deleted → 404) → list, map with `isOwner`. Includes pending rows.                                                                                                                                                                        |
| `POST /`            | locked: visible (404) → actor is owner (403 `not-project-owner`) → existing `(project, lowercased email)` row → 409 `duplicate-member` (owner's own email lands here, even at capacity) → count ≥ cap → 409 `member-limit-reached` → insert; joined if the User exists.        |
| `DELETE /:memberId` | locked: visible (404) → member row belongs to this project (404) → owner's row → 409 `cannot-remove-owner` **before any permission branch** (wins even for the owner self-removing) → actor is owner **or** the row is the actor's own (= leave), else 403 → hard delete, 204. |

### Tests

- **Unit (service):** duplicate-vs-cap precedence; owner-row-removal
  precedence over the permission branch; owner check evaluated on the
  locked-row data.
- **E2E:** new `project-members.e2e-spec.ts` — the full ticket journey:
  owner adds unknown email → pending row; that email's first `/users/me`
  claims it; the new member sees the project in their list; member leaves;
  owner removes; `duplicate-member`, `member-limit-reached`,
  `cannot-remove-owner`; member add attempt → 403.
- Add the invited-email fixtures to `apps/api/.env.e2e`
  `AUTH_ALLOWED_EMAILS`.
- **Sweep:** expand the fixture to owner / joined non-owner member /
  non-member (rule 6); split `RouteCase` into `ownerStatus` +
  `memberStatus` axes; add the three routes (`GET` member 200 / owner 200,
  `POST` member 403 / owner 201, `DELETE` member 403 for another's row /
  owner 204 — self-leave lives in the journey spec). The coverage meta-test
  fails CI until this is done.

### Contract

`pnpm generate:api-types`, commit `openapi.d.ts`, then web typecheck with
`tsc -b --force` (turbo's incremental buildinfo has false-passed stale
generated types).

---

## Phase 2 — T-3 web: members dialog

### Hooks (`src/api/hooks/`)

- `use-project-members` — query with `meta: { localErrorStatuses: [404] }`;
  re-exports `Member = dtos['MemberDto']`.
- `use-add-member`, `use-remove-member` — dialog mutations invalidating the
  members query + projects list + overview (`useInvalidateOverview`). Never
  through the overview-cache seam.

### UI

- `features/projects/members-dialog.tsx` (per both tickets — imported by the
  overview header):
  - Joined rows: avatar + name; pending rows: email + "pending" badge; owner
    badge on the owner's row. **The owner's row shows no Remove action**
    (and no Make-owner in T-4).
  - Owner-only add-by-email field with inline `duplicate-member` /
    `member-limit-reached` errors via the
    `formatToApiError(error)?.problemType?.endsWith(...)` pattern from
    `create-project-dialog.tsx`.
  - Owner-only per-row remove (non-owner rows only); non-owners see the list
    plus "Leave project" on their own row → `ConfirmDialog` → on success
    `navigate('/')`.
  - **Members query 404 while the dialog is open** (concurrent removal or
    project deletion): close the dialog and invalidate the overview — the
    overview's own 404 handling renders `ProjectNotFound`.
  - Owner-gated controls **hidden** (not disabled); the API re-enforces.
  - "Am I the owner" derives from the overview payload's `project.ownerId`
    vs `useAuthState()` user id — no extra fetch.
- Entry point: members icon button in `overview-header.tsx` next to the
  Settings button, dialog state threaded through `overview-page.tsx` like
  `projectSettingsOpen`.

### i18n

`overview.members.*` keys in all three locales (`en.json`, `fr.json`,
`es.json` — flat dotted keys; `i18next.d.ts` types off `en.json`).

### T-3 review-battery amendments (2026-08-04)

- `members-dialog.tsx` lives in `features/overview/` (not the ticket's
  `features/projects/`): its only parent is the overview page and its keys
  are `overview.members.*` — the standards review flagged the mismatch.
- Leave is the own-row action (spec wording), sharing one ConfirmDialog and
  one `pendingRemoval` state with owner-remove.
- `useInvalidateMembers(projectId)` in `use-project-members.ts` is the single
  home of the membership-change invalidation triple (members + overview +
  projects list), used by both mutations.
- Deferred, noted for later: `positiveIntEnv` env-schema helper (only two
  occurrences), returning `ownerId` from `MemberService.add`.

### Tests

- `setupMembersApi` adapter in `src/testing/mock-api.ts` (stateful, with
  `mockXError` hooks, like `setupProjectsApi`).
- Integration specs: joined/pending/owner rendering; add/remove/leave flows;
  owner-gating of controls (incl. no actions on the owner's row);
  both inline error slugs; dialog closes on members-query 404.

---

## Phase 3 — T-3 checkpoint: validation + review battery

1. `pnpm check-types && pnpm lint && pnpm format:check && pnpm test`
2. `pnpm --filter api test:e2e`
3. Review battery per the workflow rule: two-axis `/code-review`
   (standards + spec vs #55), security-review subagent over the branch diff,
   simplification subagent with the `codebase-design` skill — findings
   triaged and actioned in-branch.
4. Open the PR (T-3 scope described; note T-4 follows on the same branch).
   The T-4 build plan is then posted as a top-level PR comment per the
   workflow rule.

---

## Phase 4 — T-4 backend: transfer + soft delete/restore

### DTO

- `modules/project/dtos/input/transfer-owner.dto.ts` — `memberId` with
  `@IsUUID` (a member row id of this project).

### Repository additions (`project.repository.ts`)

All three follow the locked-transaction + order-callback shape (rules 1–3):

- `transferOwnership(projectId, currentUserId, memberId, cb)` — lock the
  visible-scoped project row; load the target member row; callback validates
  on locked state (owner check 403; target exists in this project **and is
  joined** → 409 `transfer-target-not-member` otherwise — pending rows and
  foreign member ids both land there); repository updates `project.owner`
  only, both member rows untouched.
- `softDelete(projectId, currentUserId, cb)` — lock the visible-scoped
  project row (an already-deleted project misses → 404; idempotence not
  required); callback re-checks ownership (403); set `deletedAt`.
- `restoreOwned(projectId, currentUserId, cb)` — resolution root is
  `$or: [projectVisibleTo(currentUserId), { owner: currentUserId }]`, any
  `deletedAt` (the one read allowed to see a deleted project); lock it;
  callback re-validates on the locked row: not owner → 403
  `not-project-owner`; `deletedAt` null → 409 `project-not-deleted`; live
  owned-project count ≥ cap → 409 `project-limit-reached` (best-effort
  count, rule 4); repository clears `deletedAt`.

### Service + controller (extend `project.service.ts` / `project.controller.ts`)

| Route                                   | Outcome                                                                                                      |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `POST /projects/:id/transfer-ownership` | `ProjectDto` with the new `ownerId`. No cap check on the target (D8).                                        |
| `DELETE /projects/:id`                  | 204. Soft: sets `deletedAt`; no cascade; member rows untouched. Members lose access instantly via predicate. |
| `POST /projects/:id/restore`            | `ProjectDto`. The single write that may target a deleted project.                                            |

### Tests

- **Unit (service):** pending and foreign transfer targets both →
  `transfer-target-not-member`; restore precedence (404 → 403 → 409
  `project-not-deleted` → 409 `project-limit-reached`); ownership re-checked
  on locked-row data.
- **Sweep:** add the three routes — `memberStatus` (non-owner member) 403,
  `ownerStatus` per contract; restore sets `deletedOwnerStatus: 200` (the
  one route that must succeed on a soft-deleted project, where every other
  route asserts 404).
- **E2E journeys** (extend `project-tenancy.e2e-spec.ts` or a new spec):
  transfer happy path; member attempt → 403; delete → the member's scoped
  calls 404 (list, overview, flat resource routes) while the owner's
  `GET /projects` still shows the flagged row; restore → member access
  returns exactly as before; restore on a live project → 409; deleted
  project excluded from the create cap; **restore at cap → 409
  `project-limit-reached`** (drive `MAX_OWNED_PROJECTS` low via env override
  rather than 20 fixture rows).

### Contract

Regenerate + commit `openapi.d.ts` again; `tsc -b --force` web typecheck.

---

## Phase 5 — T-4 web: governance UI

### Hooks

`use-transfer-ownership`, `use-delete-project`, `use-restore-project` —
dialog mutations invalidating the projects list (+ overview and members
queries where open).

### UI

- `members-dialog.tsx`: owner-only "Make owner" action per **joined,
  non-owner** member row with `ConfirmDialog` using a new non-destructive
  variant (transfer is consequential, not destructive — the destructive
  styling stays for delete/remove/leave); on success the owner badge moves
  and governance controls re-gate live — derived from the invalidated
  overview's `ownerId`, no reload.
- `project-settings-dialog.tsx`: owner-only danger zone at the bottom —
  "Delete project" via the shared `ConfirmDialog`; on success
  `navigate('/')`. Non-owners see the ordinary settings form with **no**
  danger zone.
- `project-list-page.tsx`: replace the `!p.deletedAt` filter with a split —
  active cards as today, plus a collapsed "Deleted" section (name + deleted
  date + Restore; **not** a link, no navigation). Restore errors are scoped
  to the row whose Restore failed (track the pending/erroring project id —
  one shared mutation error must not render beside every deleted row).

### i18n

`projects.deleted.*`, transfer confirm, danger-zone keys — all three locales.

### Tests

Integration: badge/controls swap after transfer; danger-zone confirm flow
lands on `/`; **non-owner can edit ordinary settings but sees no danger
zone**; Deleted section renders; Restore returns the card to the active
list; restore-at-cap error renders only on the affected row.

---

## Phase 6 — T-4 checkpoint: validation, review battery, docs

1. Full validation suite + API e2e (as Phase 3).
2. Review battery scoped to the T-4 diff (security review re-covers the whole
   branch).
3. Docs:
   - Tech design: record D6–D8 in the resolved-decisions table, add the
     restore `project-limit-reached` row to the slug table, amend the
     "caps are constants" line to reflect env-configured caps, note the
     best-effort cap concurrency stance.
   - PRD: amend the cap sentence — the cap gates creating and restoring
     projects, not total ownership (transfer can exceed it).
   - `docs/current-state.md`: refresh (also fixes the stale "T-2 in review"
     note — #61 is merged).
   - Delete this plan file once both tickets are merged.
4. Session close via the `close-session` flow.

---

## Cross-cutting reminders

- Every route/DTO change ends with `pnpm generate:api-types` + committed
  `packages/api-contracts/src/openapi.d.ts`; never hand-edit it.
- The sweep's coverage meta-test fails CI until every new route is in
  `ROUTES` or `EXEMPT` with a justification — it is the backstop.
- No personal information in fixtures, seeds, or docs (repo may become
  public); e2e emails stay `tenant-*@example.com`-style.
