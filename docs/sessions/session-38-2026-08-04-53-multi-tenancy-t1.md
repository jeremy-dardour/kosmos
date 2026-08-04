# Session 38 — T-1: tenancy walking skeleton, review battery, PR #59 (2026-08-04)

Covers two working sessions the same day: the T-1 build (handed off mid-review
via an uncommitted HANDOFF.md, since absorbed here and deleted) and this
close-out.

## What was done

- Built [#53](https://github.com/jeremy-dardour/wedding-planner/issues/53) on
  `feat/multi-tenancy-t1`: `ProjectMember` entity + `Project.owner`/`deletedAt`
  (one schema-only migration), actor-scoped `GET /projects`, transactional
  `POST /projects` with the 20-owned cap, attach-on-login membership claim,
  `ActorResolutionService`, two-identity `MockAuthStrategy`; web project list
  at `/`, `/projects/:projectId` routing, `CreateProjectDialog`, owner badge;
  tenancy e2e spec (5 scenarios).
- Ran the full review battery: two-axis `/code-review` (spec axis clean),
  security review (no critical/high/medium), simplification review
  (`codebase-design` skill). All findings triaged; actioned in six unitary
  commits:
  - `module-layout.md` updated for `ProjectMember`/`ActorResolutionService`;
    `ENTITIES_STANDARDS.md` FK-index claim corrected (verified against
    migrations: Postgres never auto-indexes FKs; only `@Index` or a leading
    `@Unique` column does).
  - Startup now fails when `FAKE_AUTH=true` without an explicitly set
    dev/test `NODE_ENV` (raw-config check in `validateEnv` + spec).
  - Email normalized inside `UserRepository.upsertProfile` — the seam where
    the upsert conflict target and membership claim would silently miss.
  - e2e `ConfigService.get` monkey-patch replaced by tenant emails in
    `.env.e2e`'s allow-list.
  - Project-list specs routed through `setupProjectsApi`;
    `renderOverviewPage` → `renderAtProjectRoute`.
  - T-2 constraints recorded in the
    [tech design](../specs/multi-tenancy/tech-design.md#attach-on-login).
- Validated (types/lint/format/unit 84+411/e2e 153 — all green) and opened
  [PR #59](https://github.com/jeremy-dardour/wedding-planner/pull/59).

## Decisions

Recorded where they live:

- Build-shape decisions (cap as plain unlocked count, single mixed list with
  owner badge only, date-less cards omit countdown, two hardcoded mock
  identities, generic 404 fallback until T-2, bare second seed project) — in
  PR #59's description; grilled during the build session.
- Security-review constraints for T-2 (unlink ≠ revoke; `set null` on user
  deletion reopens the email claim; DB-level `email = lower(email)` check) —
  in the [tech design, Attach-on-login](../specs/multi-tenancy/tech-design.md#attach-on-login).
- Deferred by review verdict: actor-resolution seam stays explicit per-handler
  until T-2 fixes its shape; no `normalizeEmail()` helper; no shared
  bearer-parsing module; client-side `deletedAt` filter kept (it is the
  specced interim for T-4's trash, not duplication).

## Learnings / tensions surfaced

- `ENTITIES_STANDARDS.md` carried a false premise ("FK indexes are created
  automatically") — worth verifying doc claims against generated migrations
  before acting on them.
- The e2e suite's right seam for auth config is the tracked `.env.e2e`
  fixture, not runtime `ConfigService` patching; widening the allow-list is
  inert for other specs because `auth.e2e-spec.ts`'s disallowed email stays
  off the list.
- Distinguishing an explicit `NODE_ENV` from the zod default requires
  checking the raw config in `validateEnv` — the parsed env can't tell.
- Colima can report "running" with a dead docker daemon (stale socket);
  `colima restart` recovers it.

## Status at end of session

T-1 complete and green on `feat/multi-tenancy-t1`, PR #59 open against main.
Next: merge #59, then T-2 (#54) — the security boundary (enforcement on flat
routes, `GET/PATCH /projects/:id`, overview) with the recorded constraints.
Deployment (#26) landed in parallel this same day (PR #58, Cloud Run + Neon).
