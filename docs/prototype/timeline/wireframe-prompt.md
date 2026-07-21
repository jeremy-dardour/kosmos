# Wireframe Prompt — Wedding Planner Overview

## What I need

2-3 wireframe options for the main (and possibly only) screen of a wedding preparation tracker.

## The concept

A **timeline + pipeline hybrid view** showing 20-50 workstreams at a glance.

### Workstream row

Each workstream is a horizontal row containing:

- **Identity:** name, icon, group color, owner (avatar)
- **Pipeline:** a sequence of **3-10 step circles**, color-coded by status
- **Current step pointer:** one step is always "active" — this is the most important visual element, the "you are here" marker that needs strong emphasis

Step statuses and their colors:

- Not Started (grey) — ahead of current
- **In Progress (blue) — the current step, visually prominent**
- Done (green) — behind current
- Skipped (striped/faded) — bypassed
- Blocked (red/orange) — stuck, needs attention

### Timeline axis

Steps that have a **deadline** are anchored to their date on a shared horizontal time axis. Steps without deadlines float evenly between anchored steps. Deadlines approaching or overdue need urgency treatment (color shift, icon, or glow).

### Grouping

Workstreams are **grouped by category** (visual label/color). Groups cluster rows together on the overview (think section headers or shared background).

### Checklist Steps

Some steps are "checklist steps" — they expand to reveal 2-6 unordered sub-items (just name + checkbox). All sub-items must be checked before the workstream can advance. This expansion needs a place in the UI (inline? popover? detail panel?).

### Dependencies

Visual arrows between workstream rows showing "A depends on B." No enforcement — purely informational.

## Key interactions

- **Advance a workstream** (most frequent action) — move the current-step pointer forward. If current step is Blocked, user chooses Done or Skipped before advancing. This should feel like one tap/click.
- **Zoom into a workstream** — see full detail: step names, note log (timestamped entries), links (URL + label), sub-items of checklist steps, per-step owners
- **Add a note / link** to the current step
- **Filter by owner** — "show me what's on my plate" (each step has a single owner)

## Open layout questions to explore

- One scrollable view vs. split panels (time-bound steps vs. non-time-bound)?
- How does "zoom into a workstream" work — inline expand, slide-over panel, or same view refocused?
- Can you advance/mutate directly from the overview or must you drill in first?
- Where do dependency arrows (workstream → workstream) live visually?

## Constraints

- Desktop-first (but should work on tablet)
- 2-6 users, personal tool — no complex nav or settings chrome
- Keep it minimal — this is the main daily view, not a project management suite

## Reference

Domain model and full context: see `CONTEXT.md` in the project root.
