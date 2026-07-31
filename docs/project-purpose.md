# Project Purpose

**Why this exists.** A visual tool to manage preparation for Jeremy's actual
wedding — one overview of everything that needs doing, kept up to date. It is a
real personal tool used by the couple (plus a few helpers), not a demo or a
portfolio piece.

## What it is

A pipeline tracker for the 20–50 workstreams a wedding involves (Venue,
Catering, Flowers, …). Each workstream is an ordered pipeline of steps with a
current position; the primary action is "advance" a workstream to its next step.
The overview shows every workstream and its status at a glance, with deadlines
surfaced so nothing slips.

For how the concepts are defined, see [CONTEXT.md](../CONTEXT.md) (domain
glossary); for the reasoning behind them, [docs/domain-decisions.md](./domain-decisions.md).
For the current UI direction, see
[docs/prototype/overview-editing/](./prototype/overview-editing/) — everything
is edited inline in the overview, with no detail panel. The original
[Pipeline Stack wireframe](./prototype/timeline/) still holds for grouping,
pipeline dots and deadlines, but its two-panel layout is superseded.

## Who it's for

2–6 users total: the couple as primary users, plus a few helpers. Everyone has
equal access in V1 (no roles).

## Scope boundaries (V1)

- **In:** workstreams, ordered steps, checklist steps, per-step owners/deadlines,
  append-only notes, links, visual-only dependencies, a single overview screen.
- **Out:** file uploads (links only), roles/permissions, notifications
  (pull-based only), multi-project/multi-wedding reuse, and enforced
  dependencies.
