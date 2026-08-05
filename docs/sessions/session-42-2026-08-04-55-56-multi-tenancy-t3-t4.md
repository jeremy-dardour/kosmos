# Session 42 — Multi-tenancy T-3 + T-4 built end-to-end (2026-08-04)

## What was done

- Wrote the T-3/T-4
  [implementation plan](../specs/multi-tenancy/t3-t4-implementation-plan.md),
  grilled the open decisions with Jeremy (restore cap, member-cap config,
  transfer cap, PR shape), then amended it against an external plan review —
  taking in the three-actor sweep fixture, locked governance authorization,
  duplicate-over-cap precedence, and unit-test coverage; rejecting strict
  owner-wide cap serialization and discriminated-outcome repositories.
- **T-3 (#55)**: member endpoints (`GET/POST /projects/:id/members`,
  `DELETE …/:memberId` incl. leave), `MemberRepository` with locked
  order-callback transactions, `MAX_PROJECT_MEMBERS` env, `forbidden.util`,
  members journey e2e, members dialog + hooks + i18n (en/fr/es).
- **T-4 (#56)**: transfer-ownership / soft delete / cap-checked restore with
  the shared `lockVisibleProject` governance prelude, governance journey e2e,
  Make-owner action, settings danger zone, Deleted list section + hooks.
- Extended the tenancy sweep to three actors (`ownerStatus` / `memberStatus`)
  plus a `deletedOwnerStatus` axis; restore is the one route succeeding on a
  soft-deleted project.
- Ran the full review battery **per ticket** (standards + spec axes,
  security, simplification — 8 subagent reviews) and actioned findings:
  dialog moved to `features/overview/`, row-action leave with one
  ConfirmDialog, `useInvalidateMembers` / `invalidateProjectsList`
  invalidation homes, confirm-copy table, `RestoreContext.isDeleted`,
  UTF-8 local parts rejected in `AddMemberDto`.
- Regenerated `openapi.d.ts` twice; all validation green (123 API unit,
  426 web, 236 API e2e). Opened
  [PR #64](https://github.com/jeremy-dardour/kosmos/pull/64) (closes #55,
  #56).

## Decisions

- D6 (cap-checked best-effort restore), D7 (env-configured caps), D8
  (transfer uncapped; PRD cap wording amended) — recorded in the
  [tech design](../specs/multi-tenancy/tech-design.md#resolved-decisions-2026-08-03)
  along with the governance-concurrency rules and two accepted
  information-exposure trade-offs from the security review.
- Both tickets ship from one branch/PR with a review battery closing each
  ticket (Jeremy, this session).

## Learnings / tensions surfaced

- The T-2 sweep's `memberStatus` was exercised by the **owner** — governance
  403 expectations would have tested nothing without the third joined
  non-owner actor the plan review demanded.
- A killed background `pnpm dev` left its nest child holding the port, so
  `generate:api-types` silently regenerated against **stale routes** (zero
  diff was the tell). Check the diff after generating.
- The serial API e2e suite flakes under machine load (rotating boot-time
  401/404 single failures in unrelated specs; repeatedly green when idle) —
  noted in the PR body, not a branch defect.
- MSW handler override (`server.use` after a setup factory) is a clean way to
  give one test mutable cross-endpoint state (transfer flipping `ownerId`
  across overview + members handlers).

## Addendum — PR #64 review round (2026-08-05)

- Pulled Jeremy's nine per-commit review comments off the PR, analysed and
  discussed them; five resolved as review replies (owner check stays in the
  locked `decide` callback, not a guard; sweep asymmetry kept), four actioned:
  - **Users directory decoupled from membership** (comments on overview
    `users` duplication + invalidation): overview `users` is now the
    _assignment directory_ — every referenced owner (project / workstream /
    step), member or not; membership is the members endpoint's fact alone.
    The overview page fetches members alongside the overview, owner pickers
    offer joined members only, and membership changes no longer invalidate
    the overview (transfer invalidates it itself).
  - **Ex-member owners** (removed-member question): assignments survive
    removal; ghost owners render greyed + destructive ring + former-member
    tooltip (en/fr/es). `OwnerPicker` now takes the resolved owner instead of
    finding it in its options — an ex-member owner no longer renders as
    "unassigned".
  - `findMembersForUser` → `findProjectMembers` (post-T-2, every read is
    tenancy-scoped — the suffix carried no information); `decide` documented
    against the order-callback idiom.
  - Members dialog split into `members-dialog/` per web standards.
- Fallout worth remembering: `setupOverviewApi` never served `/members`, so
  page-level integration tests were silently erroring that query under
  MSW's `onUnhandledRequest: 'error'` — a default handler now derives member
  rows from the fixture's users.
- Full battery green (types, lint, format, 123 API + 433 web unit, 236 API
  e2e); openapi regenerated against a verified-fresh server. Pushed as one
  review-round commit.

## Status at end of session

T-3 and T-4 are implemented, per-ticket-reviewed, review comments actioned,
and in review as
[PR #64](https://github.com/jeremy-dardour/kosmos/pull/64) — merging it
completes the multi-tenancy feature. Live status:
[current-state.md](../current-state.md).
