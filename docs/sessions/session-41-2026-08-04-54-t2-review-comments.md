# Session 41 — T-2 PR review comments: current-user seam rework (2026-08-04)

## What was done

- Read the eight inline review comments on
  [PR #61](https://github.com/jeremy-dardour/kosmos/pull/61) in the
  context of the commits they were left on, and discussed each with the
  reviewer before acting (three were answered without code changes: the
  Actor-vs-User duality, the two lock queries, and threading vs ambient
  request context).
- Renamed the actor seam to current-user naming across the API: `@Actor()` →
  `@CurrentUser()`, `ActorInterceptor` → `CurrentUserInterceptor`,
  `ActorResolutionService` → `CurrentUserResolutionService`, `actorId` →
  `currentUserId`, and the tenancy predicate `memberProject` →
  `projectVisibleTo`.
- Moved the interceptor from per-controller binding to a global
  `APP_INTERCEPTOR` with explicit opt-out: a new `@SkipUserResolution()`
  decorator (only `/users/me` and the e2e guard-probe controller) plus an
  automatic skip when no authenticated principal exists (`@Public()` routes).
- Removed the test-only `readStashedActor` export; the decorator unit test now
  extracts the hidden factory from Nest's `ROUTE_ARGS_METADATA` on a probe
  class instead of the production module exporting it.
- Added a sweep-coverage meta-test to `tenancy-enforcement.e2e-spec.ts`: it
  enumerates guarded routes from controller metadata and fails when a route is
  missing from the `ROUTES` matrix (or the justified `EXEMPT` list). It
  immediately caught a route-name drift (`:id` vs `:workstreamId`) and the
  unmarked e2e probe controller.
- Recorded the enforcement rules: tenancy section in
  [apps/api/STANDARDS.md](../../apps/api/STANDARDS.md), a path-scoped
  `.claude/rules/api-controllers.md` requiring a sweep entry per route change,
  and the amended seam design in the
  [multi-tenancy tech design](../specs/multi-tenancy/tech-design.md).
- Rebased the branch onto `main` after the Kosmos rebrand (#62) and cutover
  landed there: the code rename applied cleanly, the only conflicts were the
  thrice-rewritten `docs/current-state.md`, and the session log gained the
  new repo URLs. Renumbered this log to 41 (main's cutover took 40).
- Extracted the duplicated unlocked tenancy pre-read from the two lock
  queries into named helpers (`assertProjectVisible`,
  `assertWorkstreamVisible`) beside `projectVisibleTo`, so each lock query
  reads as its two phases and the accepted revoke-vs-lock race is documented
  once.
- Validated types, lint, formatting, all unit tests, and 209 API e2e tests
  at each step; API contract regeneration produced no diff. Squashed the
  session's commits into one and force-pushed the rebased branch.

## Decisions

- "Actor" naming is retired in code in favor of "current user"; the pair is
  token claims (`request.user`) vs persisted row (`request.currentUser`).
  Recorded in the
  [multi-tenancy tech design](../specs/multi-tenancy/tech-design.md).
- Current-user identity stays an explicit parameter through service and
  repository interfaces (no CLS/ambient access below the framework layer);
  the persistence seam remains framework-free.
- MikroORM global tenancy filters were considered and rejected: they fight
  the scope-at-the-root design (ADR 0009) and the lock queries' membership
  pre-reads. The structural guarantee is the globally bound interceptor plus
  the self-verifying sweep instead.
- `users` → `members` rename of the overview directory deferred to T-3, where
  membership becomes a first-class API concept.
- The lock queries keep their names and single entry point: tenancy stays
  part of their contract rather than a caller-side step, with the pre-read
  named only inside the persistence seam.

## Learnings / tensions surfaced

- The sweep meta-test proved its value on first run: non-member 404 e2e cases
  verify the data filtering of every query on a route's path, but only if the
  route is actually in the matrix — completeness of the matrix was the last
  unverified link.
- Reviewing comments against the commit they were anchored to matters: one
  concern (the error-prone membership seam) was already half-addressed by
  later commits on the branch the reviewer hadn't reached yet.

## Status at end of session

All eight PR #61 review comments are resolved — five via the current-user
seam rework on the branch, three answered in discussion — and the branch is
rebased onto the Kosmos-rebranded `main`, squashed to one commit, pushed,
and fully green. Next: merge #61, then build T-3 (#55) and T-4 (#56).
