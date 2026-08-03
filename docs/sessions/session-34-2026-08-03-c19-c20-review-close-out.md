# Session 34 — C19/C20, four-way review, review responses, PR #48 close-out (2026-08-03)

## What was done

- **C19 wrap-up**: the force-push purging the accidentally committed
  handoff file landed; C19 ticked on PR #48.
- **C20 — mobile pass** (`d247412`): the overview/card/step-editor header
  rows wrap instead of crushing titles and pushing controls off-screen;
  hover-revealed affordances always visible on coarse pointers
  (`pointer-coarse:`); group drag handle fits the shell gutter. Verified
  element-by-element at 320/375/768/1280 px against the running app;
  deliberate deferrals noted in the PR description.
- **Four-way final review** (spec / standards / security / simplicity) via
  four parallel agents over `main...HEAD`: spec conformant (all "Done when"
  items verified), standards no hard violations, security clean, simplicity
  tight. One fix applied: shared `HOVER_REVEAL` recipe (`5739399`).
- **Commit-by-commit review response** — all 34 of the user's PR comments
  read against their anchor commits, answered with a decision map, and the
  approved fixes applied:
  - `refactor(api)` `59ab7d5`: `moveToGroup(workstream, sourceGroupId)`,
    `openGapAtTop`/`closeGapAfter`, `reorderWithinGroup`,
    `GroupRepository.reorder`, entity predicates
    (`isComplete`/`touch`/`isFrozen`), framework-free persistence seam
    (MikroORM `NotFoundError`), scope documented on `Workstream.position`.
  - `refactor(web)` `72c1f85`: composite components own a folder
    (`workstream-card/`, `pipeline-row/`, `step-editor/`); `WorkstreamCard`
    rename; free-text emoji icons everywhere (picker deleted);
    `cardFrameClass`; the folder rule written into web standards.
  - `chore(web)` `373f727`: 16 dead template i18n keys swept.
  - `docs` `fe98933`: deviations persisted to their durable homes; the
    deviations log deleted, closeout posted on PR #48.
- **Option B — aggregate-root write ownership** (`85c82c3`, user-decided
  in-PR): `StepService` + `ChecklistItemService` dissolved into a
  workstream-owned structure service; controllers keep flat routes; OpenAPI
  byte-identical (verified by regeneration);
  [ADR 0009](../adr/0009-workstream-aggregate-root-write-ownership.md).
- **Independent design review** (fresh Fable agent + `codebase-design`
  skill) on the workstream/step/order/checklist structure; verdict: right
  boundaries, deep repositories. Its findings applied (`830162c`): locked
  repository writes now touch the root themselves (leaked invariant closed),
  `WorkstreamStructureService` rename, position bases corrected in the
  standard (workstream scopes 0-based, steps/checklist 1-based) with the
  load-bearing `futureSteps` sentinel documented.
- All 19 remaining PR review threads resolved; session closed for the
  squash-merge of PR #48.

## Decisions

- **Aggregate-root write ownership** —
  [ADR 0009](../adr/0009-workstream-aggregate-root-write-ownership.md);
  boundary rule also in [module-layout.md](../../apps/api/module-layout.md).
- **Ordering stays position-columns**; "order arrays on the parent +
  mandatory Default group" recorded as considered-and-deferred (ADR 0009).
  A Default group itself was explored and rejected for V1.
- **Persistence seam is framework-free** — API standards § Persistence seam.
- **Composite-component folders** — web standards § Feature structure.
- **Free-text emoji icons** at create and edit alike.
- **Deviations-log endgame executed**: durable facts persisted, log deleted,
  closeout on the PR.
- **`NULLS NOT DISTINCT`** on the workstream position constraint noted for
  the deployment PR (needs a migration; closes the unenforced ungrouped
  scope).

## Learnings / tensions surfaced

- Review comments made commit-per-commit must be read against
  `original_commit_id` + hunk, not HEAD — GitHub's API carries both.
- A hand-written standards paragraph contradicted the code the same day
  (position bases) — the independent reviewer caught it; worth keeping
  "docs claims verified against code" in final reviews.
- An invariant enforced by convention across N call sites (`touch()`)
  belongs inside the seam that owns the contract — the reviewer's
  "leaked invariant" framing.
- The `?? 0` pointer sentinel silently depends on steps being 1-based;
  load-bearing implicit couplings deserve a comment at the site.

## Status at end of session

PR #48 is merge-ready: C1–C20 landed, four-way + independent design reviews
clean, all review comments addressed and threads resolved, deviations log
closed out. Remaining: squash-merge with curated message, archive tag, then
deployment ([#26](https://github.com/jeremy-dardour/wedding-planner/issues/26)).
See [current-state.md](../current-state.md).
