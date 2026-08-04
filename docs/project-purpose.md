# Project Purpose

**Why this exists.** Kosmos is a visual tool for projects with many parallel
tracks of work — one overview of everything that needs doing, kept up to date.
It began with wedding planning and remains a real tool for active projects, not
a demo or a portfolio piece.

## What it is

A pipeline tracker for the 20–50 workstreams a complex project can involve.
Each workstream is an ordered pipeline of steps with a current position; the
primary action is "advance" a workstream to its next step. The overview shows
every workstream and its status at a glance, with deadlines surfaced so nothing
slips. Weddings, launches, moves, and other event-driven projects all fit the
same model.

For how the concepts are defined, see [CONTEXT.md](../CONTEXT.md) (domain
glossary); for the reasoning behind them, [docs/domain-decisions.md](./domain-decisions.md).
For the current UI direction, see
[docs/prototype/overview-editing/](./prototype/overview-editing/) — everything
is edited inline in the overview, with no detail panel.

## Who it's for

Small trusted project teams. Project owners choose their members; members work
together without fine-grained roles in the current version.

## Scope boundaries (V1)

- **In:** workstreams, ordered steps, checklist steps, per-step owners/deadlines,
  append-only notes, links, visual-only dependencies, a single overview screen.
- **Out:** file uploads (links only), fine-grained roles/permissions,
  notifications (pull-based only), project templates, and enforced
  dependencies.
