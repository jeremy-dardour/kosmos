# Session 26 — Slice 6 pipeline editing (2026-07-28)

## What was done

- Implemented #23 end to end: canonical project DTO completion, deferred
  ordered-position constraints, atomic pipeline replacement, and immediate
  checklist toggles.
- Added the Workstream-level pipeline editor with frozen history, current-step
  guards, owner overrides, deadlines, blocked state, and full step/checklist
  add/remove/reorder controls.
- Added stale-edit recovery and compact checklist disclosures that follow Step
  status transitions.
- Covered the frontend contract with Testing Library/MSW integration tests; no
  Playwright coverage was added.
- Ran parallel standards and spec reviews, fixed every finding, and re-ran both
  reviews to a clear result.
- Created [#39](https://github.com/jeremy-dardour/wedding-planner/issues/39)
  to review and refine the step-editing UI/design separately.

## Decisions

- A Step's explicit owner overrides its Workstream owner; no explicit owner
  means inheritance
  ([domain context](../../CONTEXT.md)).
- Pipeline structure and Step details save atomically at Workstream level;
  checklist completion remains an immediate item-level mutation
  ([API contract](../specs/v1-product/api-contract.md)).
- Current checklist content defaults expanded; past and future checklist
  content defaults compact, with past controls disabled
  ([domain context](../../CONTEXT.md)).
- Frontend behavior is covered with integration tests only for now; Playwright
  E2E remains deferred
  ([#39](https://github.com/jeremy-dardour/wedding-planner/issues/39)).

## Learnings / tensions surfaced

- Optimistic concurrency must discard a stale draft and reload the canonical
  Workstream before another edit attempt; keeping the stale token open creates
  an unrecoverable retry loop.
- Checklist disclosure state must follow Step status changes after advancing,
  not only the component's first render.
- Repeated Step and checklist controls need a dedicated visual-density review;
  that work is isolated in #39 rather than expanding Slice 6.

## Status at end of session

Slice 6 is complete on `feat/slice-6` in PR #38. Repository-wide type checks,
lint, unit/frontend integration tests, production builds, and all 92 API
integration tests pass. Both standards and spec re-reviews are clear. The next
work is to review and land PR #38, then address the UI/design follow-up in #39.
