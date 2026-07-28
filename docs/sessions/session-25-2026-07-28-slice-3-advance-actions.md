# Session 25 — Slice 3 advance actions (2026-07-28)

## What was done

- Implemented the atomic `POST /workstreams/:id/advance` application command,
  dispatching to distinct start and advance domain transitions by lifecycle.
- Added pessimistic row locking so concurrent requests serialize without
  corrupting the workstream pointer.
- Added typed `workstream-empty` and `workstream-not-advanceable` Problem
  Details responses and regenerated the OpenAPI contract.
- Added Start, Advance, Skip, and blocked-step Resolve controls to overview
  cards with row-local pending state and exact overview invalidation.
- Separated the card-selection button from action controls so advancing does
  not open the detail panel.
- Added a stateful MSW overview adapter and integration coverage for all seven
  scenarios in issue
  [#20](https://github.com/jeremy-dardour/wedding-planner/issues/20).
- Ran an independent Standards and Spec review, fixed every hard finding, and
  posted the combined report on draft PR
  [#37](https://github.com/jeremy-dardour/wedding-planner/pull/37).
- Fixed the CI-only concurrent-advance failure: the workstream lock was sound,
  but the global auth guard raced while provisioning the same email. User
  provisioning now occurs only on `/users/me` through an atomic email upsert.
- Addressed the first maintainer review pass by moving the pipeline-action
  scenarios into `overview-workstream-actions.integration.spec.tsx` with a
  shared fixture, and inlining the single-use user-upsert input shape.

## Decisions

- Keep one transport endpoint while preserving separate domain transitions;
  recorded in
  [ADR 0005](../adr/0005-workstream-pipeline-state-machine.md).
- Defer new Playwright coverage and use provider-backed MSW integration tests
  for web journeys for now; recorded in
  [Web Standards](../../apps/web/STANDARDS.md).
- Use a narrow stateful overview test adapter rather than repeated raw MSW
  route declarations.
- Keep the global auth guard read-only and make `/users/me` the explicit,
  concurrency-safe user provisioning boundary; recorded in the
  [Auth PRD](../specs/auth/PRD.md).
- Keep the workstream-action journey coverage separate from the broader
  overview and detail-panel integration suite.

## Learnings / tensions surfaced

- Contract-shaped mocks matter: real Problem Details use `title`, not
  `statusText`; the initial mocks masked a production error-display bug.
- A failing concurrency test can originate before the domain action: PostgreSQL
  showed that simultaneous authentication, not the workstream transition,
  violated the unique user-email constraint.
- A native card-selection button gives keyboard behavior without synthetic key
  handlers and keeps action controls as valid sibling buttons.
- Green, cohesive commits should be made as each implementation unit closes,
  rather than waiting for the whole frontend slice.
- A single TanStack mutation observer exposes only the latest mutation's
  variables. If actions on different workstream cards may overlap, row-local
  pending state must track every in-flight workstream ID rather than one ID.

## Status at end of session

Slice 3 is complete on `feat/slice-3` in draft PR #37. Full type-check and lint
pass, along with 166 unit/integration tests and 81 API E2E tests. One maintainer
decision remains: either track all concurrently advancing workstream IDs or
allow only one workstream action at a time. After that review decision, land PR
#37 and continue with Slice 4 (#21).
