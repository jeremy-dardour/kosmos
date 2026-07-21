# Domain Glossary

## Core Entities

### Project

The top-level container that all Workstreams (and Groups) belong to. Has a name and an optional **event date** (the wedding day) that anchors a global countdown on the overview. In V1 exactly one exists (the wedding), but "wedding" is not hardcoded — the seam keeps the model reusable ([decision 28](./docs/domain-decisions.md)). No owner and no per-project User membership in V1; no cross-project features.

### Workstream

A named track of wedding preparation work (e.g., "Venue", "Catering", "Flowers"). Has a name and an icon for quick visual identification. Contains an ordered sequence of Steps forming a pipeline, with a current-position pointer. Belongs to a Project, has an optional default Owner, and optionally belongs to a Group. Moves through three lifecycle states — **NotStarted → Active → Complete** — via `start` and `advance` (see Key Rules).

### Step

An individual action within a Workstream's pipeline. Steps are strictly ordered. A Step has: name, a status (derived from its position relative to the pointer), an optional deadline, an optional owner (inherits from the Workstream if unset), an informational `blocked` flag (meaningful only while it is the current step), and a note log (URLs in notes render as clickable links).

### Checklist Step

Not a separate type — any Step that has one or more sub-items (e.g., "Visit venues" → { Château A, Château B, Château C }). Sub-item progress is **informational**: it is shown at a glance but does **not** gate advancing ([decision 31](./docs/domain-decisions.md)). Sub-items are lightweight: name + done/skipped toggle only (no owner, deadline, or attachments).

### Group

A visual/organizational label on a Workstream used for clustering and sorting on the overview. No behavior, no roll-up status. Think: color + tag.

### Note Entry

A text entry in a Step's log, authored by a User and timestamped. The log is a thread of entries (not a single overwritable field), but an author may **edit or delete their own** entries ([decision 17](./docs/domain-decisions.md), [decision 39](./docs/domain-decisions.md)). URLs in a note render as clickable links — there is no separate Link entity ([decision 40](./docs/domain-decisions.md)). Records interactions and decisions. No file uploads in V1; external resources (Drive docs, vendor sites, contracts) are referenced by URL inside notes.

### User

A person identified by their Google email address, authenticated via Google OAuth. A User record is created on their **first login** (email, name, avatar from Google) and can be assigned as an Owner. All users have equal access (no roles in V1).

## Statuses (Step)

A Step's status is derived from its position relative to the current pointer (it is not stored):

| Status      | Meaning                                                                            |
| ----------- | ---------------------------------------------------------------------------------- |
| Not Started | Ahead of current position in pipeline                                              |
| In Progress | The current step being worked on                                                   |
| Done        | Completed (completion date recorded automatically)                                 |
| Skipped     | Intentionally bypassed (date recorded automatically)                               |
| Blocked     | Stuck/waiting — informational flag on the current step, does not prevent advancing |

## Lifecycle (Workstream)

| State      | Meaning                                                                                                   |
| ---------- | --------------------------------------------------------------------------------------------------------- |
| NotStarted | Created but not yet begun — a visible status ([decision 29](./docs/domain-decisions.md)); no current step |
| Active     | Work underway — exactly one current step                                                                  |
| Complete   | Every step passed — no current step; completion date recorded                                             |

## Key Rules

- **Pipeline model**: Steps are ordered; a Workstream has a current-position pointer. Two forward actions: `start` (begin the Workstream, activating step 1) and `advance` (record the current step's outcome and move the pointer). `advance` takes an outcome — **Done** (default) or **Skipped** — as data; there is no separate "skip" action ([decision 32](./docs/domain-decisions.md)). The pointer only moves forward; there is no undo in V1.
- **No hard gates**: `advance` is always permitted once a Workstream is Active. Neither a `blocked` flag nor unresolved checklist sub-items prevent it — the tool informs, it does not obstruct.
- **Advancing from Blocked**: Blocked is informational; the user simply chooses the outcome (Done or Skipped) when advancing.
- **Dependencies (V1)**: No structured dependencies. A wait on another Workstream's step is recorded informally — flag the Step `blocked` and add a note naming the blocker ([decision 36](./docs/domain-decisions.md)).
- **Pipeline mutability**: Only the **future** part of a pipeline is freely mutable (add / delete / reorder steps). The current step can be edited but not moved or deleted; past steps are frozen except that notes may still be appended ([decision 33](./docs/domain-decisions.md)).
- **Deadlines = milestones**: No separate milestone flag. Any step with a deadline is implicitly a milestone. Deadlines surface as a per-card countdown badge plus date-ticks under the relevant step dots ([decision 24](./docs/domain-decisions.md)), not on a shared time axis. The last step _should_ carry a deadline so the Workstream has a target, but this is a **soft convention** surfaced as a nudge, not enforced ([decision 38](./docs/domain-decisions.md)).
- **Completion dates**: Automatically recorded when a step is marked Done or Skipped.
- **Ownership inheritance**: Owners are optional (a Workstream or Step may be unassigned). Steps inherit the Workstream's owner unless explicitly overridden.
- **Parallelism**: Handled at the Workstream level (separate workstreams run independently), not within a pipeline — except via Checklist Steps for unordered sub-items within a single step.
- **Access control (V1)**: Gated outside the app — no in-app whitelist. Google OAuth for identity; access is limited to the OAuth app's allowed users, with a static `.env` allow-list as a fallback ([decision 26](./docs/domain-decisions.md)).
- **Notifications (V1)**: Pull-only — no email/push. Deadlines surface via the per-card countdown badge ([decision 27](./docs/domain-decisions.md)).

---

The reasoning behind these entities and rules — the numbered domain decisions
referenced above — lives in [docs/domain-decisions.md](./docs/domain-decisions.md).
