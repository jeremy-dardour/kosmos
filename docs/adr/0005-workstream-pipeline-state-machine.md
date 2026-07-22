# ADR 0005: Workstream pipeline state machine

**Status:** Accepted — 2026-07-18

Context for the domain terms here: [CONTEXT.md](../../CONTEXT.md). This ADR is the
single home for **how the pipeline is represented and mutated**; the domain-level
rules it implements are documented in the
[V1 Product PRD](../specs/v1-product/PRD.md).

## Decision

A Workstream is a strictly-ordered list of Steps with a **current-position
pointer**, driven by a small state machine that lives in **one** authoritative
domain module.

### State representation

Three fields on the Workstream, no stored status enum:

| Field           | Type               | Meaning                                                |
| --------------- | ------------------ | ------------------------------------------------------ |
| `startedAt`     | nullable timestamp | when work began (set by `start`)                       |
| `completedAt`   | nullable timestamp | when the last step was passed (set by final `advance`) |
| `currentStepId` | nullable FK → Step | which step is current; non-null **iff** Active         |

Lifecycle is **derived** from the timestamp pair, never persisted as an enum:

| `startedAt` | `completedAt` | `currentStepId` | Derived state  |
| :---------: | :-----------: | :-------------: | -------------- |
|    null     |     null      |      null       | **NotStarted** |
|     set     |     null      |       set       | **Active**     |
|     set     |      set      |      null       | **Complete**   |

**Core invariant:** `currentStepId` is non-null **⟺** Active (`startedAt` set,
`completedAt` null). The other corners — `completedAt` set while `startedAt`
null; `currentStepId` set while not Active; `startedAt` set and `completedAt`
set and `currentStepId` non-null — must never occur.

This mirrors the Step itself (an interval bounded by "became current" and
"got an outcome + date"), one level up — the symmetry is deliberate and makes
the whole model easier to hold in the head.

### Step position & status

The **pointer is the single source of truth** for position. A Step stores only
its **outcome** once passed:

- `outcome` ∈ { `Done`, `Skipped`, `null` }, plus `outcomeAt` (auto-recorded).
- `blocked` boolean — meaningful **only** while the step is current (informational).

A Step's _status_ is **derived**, never stored:

- before the pointer → `Done` / `Skipped` (its recorded outcome)
- at the pointer → `InProgress` (or shown as Blocked if `blocked`)
- after the pointer → `NotStarted`

This makes the illegal states (two "In Progress" steps, a gap, an outcome on a
future step) unrepresentable rather than merely discouraged.

### Transitions (the only two forward mutations)

- **`start()`** — valid only from NotStarted → sets `startedAt = now`,
  `currentStepId = step 1`. Records **no** step outcome (nothing has finished).
- **`advance(outcome = Done | Skipped)`** — valid only from Active → records the
  current step's `outcome` + `outcomeAt`, moves the pointer to the next step. On
  the **last** step it instead sets `completedAt = now`, `currentStepId = null`.
  `outcome` is a **parameter** (data), defaulting to `Done`; there is no separate
  persistent "skipped" flag and no separate `skip` action.

The pointer only ever moves **forward**. There is no backward move and no undo
in V1 (see Consequences). An empty Workstream (zero steps) goes NotStarted →
Complete on the first `advance`.

### No hard gates

`advance` is **always permitted from Active**. Nothing blocks it:

- `blocked` is informational (Decision 5).
- Checklist sub-items are informational — progress is shown, not enforced
  (Decision 31). Advancing past a checklist step with unresolved sub-items
  freezes them as-is in history.

The only rejection path is "not currently Active" (i.e., calling `advance` on a
NotStarted or Complete Workstream, or `start` on a non-NotStarted one).

### Pipeline mutability

Steps are ordered by an integer `position`. What can change depends on where the
step sits relative to the pointer:

|                         | Structure (move / delete / insert) | Attributes (name, deadline, owner, blocked, checklist items) | Append a note |
| ----------------------- | :--------------------------------: | :----------------------------------------------------------: | :-----------: |
| **Past** (Done/Skipped) |              ✗ frozen              |                           ✗ frozen                           |       ✓       |
| **Current**             |              ✗ frozen              |                              ✓                               |       ✓       |
| **Future** (NotStarted) |                 ✓                  |                              ✓                               |       ✓       |

Reordering happens **only among future steps** and is implemented as renumbering
that tail in one transaction. Because you can neither insert behind the pointer
nor delete the current/past steps, the pointer can never be orphaned. A step you
decide never to do is **deleted** (it's a future step), not skipped-in-advance.

### One authoritative module

All of the above — `start`, `advance`, and the derivation of lifecycle / per-step
status — lives in a single domain module (a Workstream aggregate/service). API
handlers and the overview read-model call **through** it; nothing else
reconstructs pointer logic or writes these fields directly. Its public surface is
small (`start`, `advance`, `state`); the invariant-heavy internals are hidden.

## Why

- **Pointer over derived-position:** storing a full status enum per step (and
  inferring position from it) requires enforcing "exactly one In Progress, all
  before it resolved, all after it not-started" on every write. A pointer makes
  that invariant structural — `advance` is the only thing that moves it.
- **Timestamp pair over stored lifecycle enum:** the enum is fully derivable from
  `(startedAt, completedAt)`, so storing it is redundant and drift-prone. The
  pair also disambiguates the two "no current step" cases (NotStarted vs
  Complete) that a lone nullable `currentStepId` would conflate, and `startedAt`
  is genuinely useful data ("kicked off Venue three weeks ago").
- **`start` as a real transition, not a special case:** the first move records no
  outcome (nothing has finished), so it is genuinely different from a
  step-to-step advance. Modelling it as its own guarded transition is cleaner
  than overloading `advance` with a "were we NotStarted?" branch, and it earns
  its keep by making "NotStarted / untouched" a visible status on the overview
  ("we haven't even opened Flowers yet").
- **One action with an outcome parameter:** Done vs Skipped is _information about
  how a step ended_, not control flow — both simply move the pointer. Collapsing
  them to `advance(outcome)` avoids a limbo "pre-marked skipped but still current"
  state and a second source of truth.
- **No hard gates:** consistent with Blocked (Decision 5) — the tool _informs_,
  never _obstructs_. For a 2–6 person trusted tool, enforcement is friction with
  no payoff, and it keeps `advance` free of rejection logic.
- **Freeze the past, edit the future:** you re-plan the part you haven't done yet
  (that's what you learn as you go); the past is settled history. This also
  guarantees the pointer is never invalidated by a structural edit.
- **One module:** "where does transition logic live" is exactly the kind of
  decision that, left implicit, gets re-implemented inconsistently across
  handlers. Centralising it keeps the invariants in one testable place.

## Trade-offs / consequences

- **No undo in V1.** Because the past is frozen and the pointer only moves
  forward, a mis-click on `advance` is not cleanly reversible in-app — correcting
  it needs data surgery. Accepted for V1; if it bites, the smallest fix is an
  "undo last advance" that re-opens the most recent step (un-records its outcome,
  moves the pointer back). Revisit then.
- **NotStarted costs a real transition.** Keeping the "untouched" signal means
  building and testing the `start` path and the (set,set,non-null) illegal
  corner. Judged worth it for the overview signal.
- **`startedAt` is an extra column** vs. a `currentStepId` + `completedAt`-only
  encoding. Paid deliberately to remove the overloaded null and to keep a useful
  timestamp.
- **Checklist has no discriminator** (Decision 30): "checklist step" = "a Step
  with ≥1 sub-item." An intended-but-empty checklist is indistinguishable from a
  normal step. Acceptable.
- **The invariant is load-bearing.** `advance`/`start` must be transactional so
  the illegal corners never persist; the derived-status read path must trust the
  invariant rather than re-validate it everywhere.
