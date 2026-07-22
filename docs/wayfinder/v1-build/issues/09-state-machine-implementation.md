<!-- wayfinder:grilling -->

# State machine implementation: start, advance, transactions

Type: grilling
Status: open
Blocked by: 04

## Question

ADR 0005 defines _what_ `start` and `advance` do. The API contract defines the
endpoints. Neither specifies _how_ the workstream service implements the
transactional logic with MikroORM 7.

Decide:

- **Transaction shape** — how `advance` loads the workstream + steps, validates
  the current state, records the outcome on the current step, moves the pointer
  (or sets `completedAt` on the last step), all atomically. MikroORM's unit of
  work vs explicit `em.transactional()`.
- **Pointer update** — `currentStepId` is a circular FK (Workstream → Step).
  On `advance`, the old step gets an outcome and the pointer moves to the next
  (or nulls out on completion). Ordering of writes matters for the `RESTRICT`
  constraint on `currentStepId`. Does MikroORM's flush ordering handle this, or
  does it need explicit sequencing?
- **Position-based next-step lookup** — finding "the step after the current one"
  by position. Edge cases: gaps after deletions (should not exist if renumber
  works correctly, but defensive?), empty workstream (zero steps →
  NotStarted → Complete directly).
- **Validation placement** — state-machine guards (`start` only from
  NotStarted, `advance` only from Active) as domain-service checks vs
  entity-level methods vs guard/interceptor. Where in the call stack do invalid
  transitions get rejected?
- **Derived state computation** — `lifecycle`, `step.status`,
  `nearestDeadline`, owner resolution. Pure functions on entities? A mapper
  service? Inline in the DTO construction?
- **Step mutability enforcement** — how does the service know if a step is
  past/current/future when handling `PATCH /steps/:id` or
  `DELETE /steps/:id`? Load the parent workstream and compare positions vs
  the pointer?
- **Reorder implementation** — `ReorderStepsDto` sends a full ID list for future
  steps. How to validate it matches the current future set, and how to
  bulk-assign new positions within the deferred unique constraint.

Output: implementation decisions for the workstream service, ready for the
build increment. May warrant its own ADR if the transaction/flush-ordering
pattern is load-bearing.
