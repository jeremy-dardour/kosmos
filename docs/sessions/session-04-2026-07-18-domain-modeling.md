# Session 04 — Domain Modeling (2026-07-18)

## What was done

**1. Closed the last three open product questions** from `current-state.md`:
- Access control, notifications, single-vs-generic scope.
- Introduced a top-level **Project** entity ([CONTEXT.md](../../CONTEXT.md)) as the
  container all Workstreams belong to; "wedding" is no longer hardcoded.

**2. Grilled the pipeline model end-to-end** (via `/grilling` + `/domain-modeling`)
and pinned down the Workstream **state machine**. Walked the design tree
decision-by-decision; the full representation, invariants, and consequences are
captured in **[ADR 0005](../adr/0005-workstream-pipeline-state-machine.md)**.
Headlines:
- **Pointer is the source of truth** for position (not a status enum per step);
  a step stores only its outcome once passed. Illegal states (two "In Progress",
  gaps) become unrepresentable.
- **Lifecycle = NotStarted / Active / Complete**, derived from a `startedAt` /
  `completedAt` timestamp pair (no stored enum); `currentStepId` non-null ⟺ Active.
- **Two guarded transitions:** `start` (activates step 1, records no outcome) and
  `advance(outcome = Done | Skipped)` (records outcome + moves pointer; final step
  sets `completedAt`). One action, outcome as data — no separate skip action.
- **No hard gates anywhere** — `blocked` and checklist sub-items are both purely
  informational; `advance` is always permitted from Active.
- **Mutability:** future steps fully mutable, current step editable but not
  structurally moved/deleted, past steps frozen (notes still appendable).
- **One authoritative module** owns `start` / `advance` / state derivation.

**3. Modelled supporting entities:** `User` (rows on first login, nullable owner
FKs with inheritance), `Group` (real entity, nullable + single per workstream,
color on the group).

**5. Finished the tree — remaining entity questions** (Decisions 36–40):
- **No Dependency entity in V1** (for simplicity) — cross-step waits are a
  `blocked` flag + note. Defers Decisions 11/12/23.
- **Project** holds an optional `eventDate` (wedding day → global countdown); no
  owner, no per-project membership.
- **"Last-step deadline" is a soft nudge**, not enforced — consistent with
  no-hard-gates, and the "last step" moves as future steps are edited.
- **Notes are author-editable/deletable** (relaxes Decision 17's immutability;
  thread model stands).
- **No Link entity** — URLs in note bodies render clickable (folds Link into
  notes; Decision 16's "URLs only, no uploads" stands).

**4. Propagated everything** into the single-home docs: `CONTEXT.md` (Project,
lifecycle, revised Checklist/Step/User, new rules), `domain-decisions.md`
(Decisions 26–35), `project-purpose.md` (removed auth detail), and ADR 0005.

## Decisions

- **Domain:** [Decisions 26–40](../domain-decisions.md) — access gated outside
  the app (26, supersedes 19), notifications pull-only (27), generic Project (28),
  Workstream lifecycle with visible NotStarted (29), checklist derived (30) &
  informational (31), single `advance(outcome)` action (32), future-only pipeline
  mutability (33), `User` entity + nullable owners (34), `Group` entity (35), no
  Dependency entity (36, defers 11/12/23), Project `eventDate` (37), soft
  last-step-deadline (38), author-editable notes (39, relaxes 17), no Link entity
  (40, folds into notes).
- **Technical:** [ADR 0005](../adr/0005-workstream-pipeline-state-machine.md) — the
  pipeline state-machine representation, invariants, and the single-module rule.

## Learnings / tensions surfaced

- **Sentinel steps (NOT_STARTED / COMPLETED bookend rows) were proposed and
  rejected.** They make the pointer uniformly non-null but turn `Step` into a
  heterogeneous type whose "real vs sentinel" distinction leaks into every reader;
  the special-casing relocates rather than disappears. A Workstream-level
  timestamp pair gets the same property cleanly. (Full reasoning in ADR 0005.)
- **A stored `lifecycle` enum is redundant** — `(startedAt, completedAt)` already
  encodes all three states. Jeremy caught this; we derive instead of store.
- **"Simplest wins" repeatedly pushed toward fewer hard rules** — collapsing
  skip into an `advance` parameter, and making checklists informational so there
  are zero hard gates. Consistent with the existing "Blocked never obstructs".
- Kept auth/implementation detail **out of** `project-purpose.md` (why/who/scope
  only); those specifics live in `CONTEXT.md` rules + the decisions log / ADR.

## Open questions

**None** — the grill walked the whole tree. The V1 domain model is fully
specified across [CONTEXT.md](../../CONTEXT.md), [ADR 0005](../adr/0005-workstream-pipeline-state-machine.md),
and Decisions 26–40.

## Status at end of session

Domain model **complete**: the pipeline state machine is fully specified
(ADR 0005) and every entity is pinned down (Decisions 29–40). Still
**pre-implementation** — no domain code written. Next: translate CONTEXT.md +
ADR 0005 into a DB schema + API shape, then break it into buildable increments.
