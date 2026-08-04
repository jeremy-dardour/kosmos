# Session 33 — Widget panel: grilling, prototype, tickets (2026-07-31)

## What was done

- **Grilled the "deadline calendar + project stats" idea** end-to-end before
  any code: scope (post-V1), entry mechanism, widget model, calendar content
  scope, filter behaviour, stats metric set, interactivity, and ticket
  packaging. All decisions recorded in
  [docs/prototype/widget-panel/NOTES.md](../prototype/widget-panel/NOTES.md).
- **Built a UI prototype** on top of the `?variant=A` inline-overview
  prototype: right-edge icon rail + split panel with a stats widget and three
  calendar forms (`agenda` / `grid` / `hybrid`) compared live via a `?panel=`
  switcher. Verified cross-linking (calendar entry → scroll + open the step's
  inline editor), hover highlight, and filter mirroring with an indicator
  chip against real seed data.
- **Applied the verdict** after review: panel converged to three collapsible
  sections (Project pulse / Calendar month grid / Agenda), single rail
  toggle, `?panel=` switcher removed. Also softened the card's Advance split
  button (secondary + border instead of solid black) and added spacing after
  the badge cluster — a refinement of #40 §3.8 recorded in NOTES.md.
- **Created the build tickets**:
  [#49 — Widget panel A: rail, panel shell + stats widget](https://github.com/jeremy-dardour/wedding-planner/issues/49)
  and
  [#50 — Widget panel B: deadline calendar (month grid + agenda)](https://github.com/jeremy-dardour/wedding-planner/issues/50)
  (#50 depends on #49; both depend on #40), each with exact stat/content
  definitions, ASCII layouts, testing lists, and integration notes for the
  in-flight #40.

## Decisions

- All widget-system decisions (rail, stacked collapsible sections, filter
  mirroring, pending-only calendar content, five-band urgency reuse, stats
  metric set, injected-callback reusability constraint, two-ticket split) —
  formally recorded in
  [docs/prototype/widget-panel/NOTES.md](../prototype/widget-panel/NOTES.md)
  and the ticket bodies (#49/#50).
- **Reuse constraint**: widgets are presentational (data + injected
  `onEntryClick`/`onEntryHover`) so a future multi-project overview can
  render them per project without overview navigation.
- **Advance button restyle** (secondary treatment, extra margin, placement
  stays after-title) — carries into #40's `workstream-card-action.tsx`
  restyle; noted in NOTES.md § side verdict.

## Learnings / tensions surfaced

- The month grid alone is misleading on sparse data — a full month rendered a
  single marked day; the agenda carries identification. The user's answer was
  "both, stacked, collapsible" rather than picking one.
- The prototype's cross-link (DOM `CustomEvent` + card element ids) is
  expedient but not the production model; #49/#50 call for a lifted
  open-step seam on the production card list.
- With sections collapsible in place, per-widget rail icons became redundant
  — the rail reduced to one panel toggle.

## Status at end of session

Prototype answered its questions and the verdict is recorded; #49/#50 are
filed for post-V1. Prototype code (`widget-panel-prototype*.ts(x)`, seam
edits in `overview-page.tsx` / `overview-editing-prototype.tsx`) stays on
this branch as reference until absorbed. See
[current-state.md](../current-state.md) for live status.
