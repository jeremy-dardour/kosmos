# Session 31 — Inline overview editing settled and handed off (2026-07-31)

## What was done

- Picked up the in-flight overview-editing prototype (iteration 3, three
  variants), deleted variants B and C, and iterated on the winner across ~8
  rounds of visual review with Playwright MCP against real API data.
- Ran two temporary switchable axes (deadline treatment, notes treatment) and
  later a third (card chrome), settling each in turn and deleting the losers and
  the switcher once decided.
- Restored future-tail reordering, which only the deleted variants had.
- Cleaned the branch to one prototype file plus a `?variant=A` seam; deleted the
  interim working docs (`NOTES.md`, `ISSUE-DRAFT.md`).
- Wrote the productionalisation handoff, including an appendix specifying every
  behaviour surface by surface:
  [docs/prototype/overview-editing/HANDOFF.md](../prototype/overview-editing/HANDOFF.md).
- Updated the V1 Product PRD and api-contract PRD to the new design, and deleted
  the superseded two-panel wireframe (`docs/prototype/timeline/`).
- Consolidated the UI rework tickets into
  [#40](https://github.com/jeremy-dardour/wedding-planner/issues/40); closed
  #35, #39, #41 and #43 as folded in.

## Decisions

All design decisions and the ten rejected alternatives are recorded in
[HANDOFF.md](../prototype/overview-editing/HANDOFF.md) §3 and §5; the resulting
product behaviour is now specified in the
[V1 Product PRD § The overview](../specs/v1-product/PRD.md).

Three decisions are deliberately **not** made and block implementation — note
counts on the overview aggregate, the save model, and where Advance lives. They
are B1–B3 on #40 and §4.1/§6 of the handoff.

## Learnings / tensions surfaced

- **Prototyping against the real API found two production bugs** that unit tests
  did not: `overview.badge.upcoming` renders "in 0d" for a deadline due today,
  and date ticks drop the year, so a 2025 deadline reads as a future date. Both
  still live on `main`; fixed only inside the prototype.
- **A UI decision hit a hard infrastructure limit.** Per-step note markers need
  a count per step; fetching per card exceeded the 30/min throttle on a single
  page load. The rate limiter, not taste, is what forces `noteCount` onto the
  overview aggregate.
- **The chosen interaction has no matching endpoint.** Autosave was picked
  because a local draft is free, but the pipeline endpoint is an atomic
  whole-tail replace guarded by a concurrency token. Prototypes that fake
  persistence can settle an interaction that the contract cannot serve — worth
  checking earlier next time.
- **A finished-looking prototype can be missing the primary action.** The cards
  carry every editing affordance and no Advance/Start/Resolve. Only caught while
  auditing the handoff for completeness, not during eight rounds of visual
  review — the eye checks what is present, not what is absent.
- Reviewing the prototype surfaced a **real rule violation in it**: past steps
  were fully editable, contradicting "past steps are frozen except that notes may
  still be appended". Fixed, and it exposed a second bug (insert-after offered on
  a past step).
- CSS constraint worth remembering: **a parent `opacity` cannot be undone by a
  child**, so "dim everything except the selected thing" must dim the parts, not
  the container.
- Working preference confirmed: keep competing treatments switchable side by
  side until a verdict, then collapse to one immediately rather than carrying
  options forward.

## Status at end of session

Branch `prototype-2` is pushed with two commits — the settled prototype, and the
spec adoption. Type-check, lint and 182 web tests pass. The design is closed;
implementation is not started and is tracked by #40, which cannot begin until
its three blocking decisions are made. See
[current-state.md](../current-state.md).
