# ADR 0009 — Workstream aggregate-root write ownership

**Status:** accepted (PR #48 review discussion, 2026-08-03)

## Context

Every structural mutation of a pipeline — step create/edit/delete/reorder,
checklist item create/edit/delete — already serializes on one
`PESSIMISTIC_WRITE` lock of the workstream row and re-reads the step graph
under it. The locking treated Workstream as an aggregate root, but the service
layer did not: `StepService` and `ChecklistItemService` owned operations that
renumbered sibling steps, validated against the pipeline pointer, and bumped
the workstream's `updatedAt` — child services routinely mutating their parent.

The review diagnosed the underlying smell: **ordering is the parent's
concern**. A child's `position` column is the parent's ordering encoded on
child rows as a persistence detail; letting a child-entity service write it
smears the parent's responsibility across the module.

## Decision

The Workstream is the **write-side aggregate root** for itself, its Steps and
their ChecklistItems:

- Only workstream-owned services (`workstream.service.ts` for lifecycle,
  CRUD and workstream ordering; `workstream-pipeline.service.ts` for
  structural mutation of steps and checklist items) mutate anything inside
  the aggregate. Services below the root never mutate upward.
- Child routes keep their flat URLs (`PATCH /steps/:id`,
  `DELETE /checklist-items/:id`, …) — the aggregate boundary lives in the
  service layer, not the URL. Their controllers delegate to the root's
  services.
- Every aggregate mutation resolves and locks the root first through the
  shared lock queries (ADR 0008), then re-reads the child under the lock —
  which is why a concurrently deleted child 404s instead of resurfacing
  stale.
- Notes are outside the structural aggregate: they append to steps without
  touching pipeline structure and keep their own service.

## Considered and deferred: order arrays on the parent

Representing order as an id array on the parent (`stepOrder` on Workstream,
etc.) was seriously considered — it would make reorders a one-row write and
delete the renumbering machinery. Rejected for V1 because membership would
gain two sources of truth with no FK enforcement inside arrays, `position` is
domain-meaningful for steps (status derives from it, SQL orders by it), and
the workstream level has no parent row for the ungrouped scope — an array
model there requires a mandatory Default group first. If ordering
requirements grow, revisit arrays **together with** the Default-group change
as one modeling PR.
