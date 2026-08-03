# Session 32 — Second prototype pass; B1–B3 and ordering settled (2026-07-31)

## What was done

- **Second prototyping pass on `prototype-2`** (five improvements, all live at
  `/?variant=A`): a collapsed Completed section at the page bottom; drag & drop
  ordering (workstreams within group + whole groups, via dnd-kit); the
  Advance/Start/Resolve control restored to the card with a three-way placement
  switcher; step titles raised to 13px; an owner-override avatar under dots; a
  light frame on complete cards; native tooltips on icon-only buttons.
- **Grilled and settled the ordering model** (completed section semantics, drag
  scopes, pure-manual order, persistence shape) before writing any code.
- **Settled all three blocking decisions on #40** — B1 (`noteCount` on the
  aggregate), B2 (the save model: commit-on-blur + granular endpoints replacing
  the whole-tail pipeline PUT), B3 (advance control right of the status
  badges) — through a second grilling pass over the whole backend data
  lifecycle (D1–D7).
- **Moved the api-contract PRD** to
  [docs/specs/v1-product/api-contract.md](../specs/v1-product/api-contract.md)
  (sibling of the V1 PRD; OpenAPI is the live contract) and rewrote it around
  the granular model, ordering endpoints, `noteCount`, cache-patching rules and
  the throttle raise.
- **Updated the handoff** (§3.5–3.8, §6 settled, appendix A14–A16) and the
  [V1 Product PRD](../specs/v1-product/PRD.md) (manual ordering, Completed
  section, advance control, override marker).
- **Wrote the phased implementer plan**:
  [overview-rework-plan.md](../specs/v1-product/overview-rework-plan.md).
- Posted the settled-decisions summary on
  [#40](https://github.com/jeremy-dardour/wedding-planner/issues/40).

## Decisions

All formally recorded in their homes — the session made many:

- Ordering + Completed section: handoff §3.6–3.7 / PRD § card list.
- Advance placement + form (B3): handoff §3.8 / A16.
- B1, B2 and the full data-lifecycle set (granular endpoints, last-write-wins,
  response patching, focus-deferred trailing invalidate, ghost steps,
  throttle raise): [api-contract.md](../specs/v1-product/api-contract.md) and
  handoff §6.
- Doc placement: the api-contract spec lives next to the V1 PRD; OpenAPI is
  the authoritative live contract.

## Learnings / tensions surfaced

- **The throttle evidence for B1 reproduced itself twice more** during routine
  visual checks — every page reload of the prototype trips 30/min. The
  decision wrote itself.
- **dnd-kit specifics cost real iteration**: the sortable transform's scale
  component deforms unequal-height cards (use `CSS.Translate`); one page-wide
  context stutters against foreign drop targets (one context per group also
  enforces within-group-only by construction); a 4px distance gate keeps the
  card's dense click targets from starting drags.
- **User preferences discovered**: tooltips (at least native `title`) expected
  on every icon-only button; completed cards need a visible (light) frame —
  fully bare was too invisible; advance reads better next to the status than
  in the crowded top-right.
- The whole-tail pipeline PUT (built in Slice 6) is removed by the new
  contract — an editing-session endpoint has no caller in a no-Save UI. Its
  guards survive as per-operation validation.

## Status at end of session

Design and contract for #40 are fully settled — nothing blocks
implementation. `prototype-2` holds the prototype (4 commits today), the
updated handoff/PRDs and the
[implementation plan](../specs/v1-product/overview-rework-plan.md). Next:
land the in-flight slice PRs (#44, #37, #38, slice-5), then execute the plan
phase by phase (backend first). See
[current-state.md](../current-state.md).
