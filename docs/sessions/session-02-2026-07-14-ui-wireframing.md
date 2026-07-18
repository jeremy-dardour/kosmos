# Session 02 — UI Wireframing (2026-07-14)

## What was done

Took the overview concept through a wireframing pass (three turns of
exploration) and chose a direction. Full spec and the wireframe file are in
[docs/prototype/timeline/](../prototype/timeline/); **turn 3 / option 3a** is
the chosen layout.

## Decisions

Decisions 20–25 in [docs/domain-decisions.md](../domain-decisions.md):
two-panel "Pipeline Stack" layout, advance-from-card, slide-over detail,
dependencies-as-text-list, per-card deadline countdowns (7-day threshold), and a
per-workstream icon.

## Learnings / tensions surfaced

- The **shared time-axis** from Session 01 (Decision 14) didn't survive: a common
  timeline across 20–50 workstream rows was cluttered and hard to scale. Replaced
  by per-card countdown badges + date-ticks (Decision 24).
- **Dependency arrows** (explored in wireframe turn 1a) were dropped for the same
  reason — a plain "depends on" list in the detail panel is enough for V1.

## Status at end of session

UI direction locked. Overview open questions from Session 01 (layout, mutations,
detail view, dependency display, urgency thresholds) all resolved. Remaining:
whitelist management, notifications, multi-project scope.
