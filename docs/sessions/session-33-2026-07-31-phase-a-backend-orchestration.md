# Session 33 — #40 orchestration: Phase A backend (C1–C7) (2026-07-31)

## What was done

- Started executing the [#40 build plan](../specs/v1-product/overview-rework-plan.md)
  as an orchestrator: one Opus implementer subagent per commit (briefed with the
  plan entry verbatim, the contract/handoff excerpts, explicit non-goals, and a
  strict comment rule), with the orchestrator reviewing every diff, running the
  gates, and owning the commits.
- Created `feat/40-overview-rework` from `prototype-2`; squashed the nine
  prototype-iteration/docs commits into one design commit (git plumbing, tree
  byte-identical) so the PR reviews cleanly. PR #48 opened (by Jeremy);
  description with a live C1–C20 progress checklist and a "how to review"
  comment added.
- **Landed all of Phase A, each commit green** (typecheck, lint, format,
  unit, API e2e — 155 e2e at phase end):
  - C1 `noteCount` on the overview aggregate (grouped count join in the
    repeatable-read snapshot; compiler-enforced counts parameter on the DTO
    mappers).
  - C2 manual-ordering `position` columns + alphabetical-seeding migration +
    create-at-top + group-move renumbering under a project-row lock.
  - C3 group/workstream reorder endpoints (membership validated inside the
    locked transaction; 409 `order-mismatch`).
  - C4 granular step create/edit/delete with guards extracted to
    `step-mutability.util.ts`, shared with the legacy whole-tail PUT.
  - C5 future-tail step reorder (slot-reuse renumber — past/current never
    shift).
  - C6 checklist item create/rename/delete; all checklist ops share one
    `step-frozen` guard; shared workstream-graph lock helper.
  - C7 throttle 30 → 120/min.
- Review catches that mattered: C2's group append derived positions from a row
  _count_, which collides after a delete leaves a hole — fixed to max+1 with a
  regression e2e (the same rule then flowed into C6's checklist append).
- C3 **falsified a spec premise**: the plan/contract claimed the position
  unique constraints "are not deferrable" and required two-phase temporary
  positions; C2 had generated them `deferrable initially deferred` and the
  existing step/checklist idiom was already single-phase. Both docs amended.

## Decisions

- [ADR 0008](../adr/0008-shared-queries-as-em-parameterized-functions.md) —
  shared/transaction-joining queries as `em`-parameterized functions in
  `repositories/<concern>.query.ts`; standards updated (came out of Jeremy
  challenging C1's `note-count.query.ts` shape).
- Workstream reorder membership = **live** workstreams; Complete siblings are
  renumbered to trail the live tail (recorded in the
  [API contract](../specs/v1-product/api-contract.md) §Manual ordering).
- New groups append at the **end** of the project (create-at-top applies to
  workstreams only).
- `blocked` PATCH semantics ported from the whole-tail PUT (writable on any
  non-frozen step, inert off the pointer) — no new rejection invented.
- Granular step/checklist ops bump the workstream `updatedAt` so the legacy
  `expectedUpdatedAt` token notices them until C18 removes it.

## Learnings / tensions surfaced

- Turbo's incremental web typecheck produced a **false pass** after generated
  types changed; `tsc -b --force` is now part of the gate for api-contracts
  ripple.
- The dev API's watcher can die silently (stale `dist` on the .env port);
  agents now regenerate api-types against a temporary built instance and never
  touch the user's processes.
- `pnpm format:check` joined the per-commit gates (a former commit had landed
  unformatted); `todo.md` (personal scratch) is git- and prettier-ignored.
- Comment discipline for subagent output is now a global user instruction and
  part of the orchestrator's review checklist.
- Known flakes, both unrelated to this branch: two date-sensitive
  `project-crud` e2e tests failed once (unreproducible in 25+ runs); one
  supertest "Parse Error" transport flake.

## Status at end of session (phase checkpoint)

Phase A (backend) is fully landed on `feat/40-overview-rework` and pushed; PR
#48 tracks progress. Next: Phase B (C8 urgency tokens/five bands, C9 the two
date bugs, C10 mutation hooks + the overview cache seam), then Phase C
components, Phase D cleanup. Mirrored in
[current-state.md](../current-state.md).
