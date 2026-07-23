# V1 Product PRD

What the first version of the wedding-preparation tracker does, how it behaves,
and where the edges are. This is the **single reference** for what V1 delivers
and why each choice was made.

Implementation PRDs (the per-increment build specs) reference this document for
the full behavioral contract. For the domain glossary see
[CONTEXT.md](../../../CONTEXT.md); for the UI wireframe see
[docs/prototype/timeline/](../../prototype/timeline/).

---

## Product in one sentence

A visual pipeline tracker where a small group manages the 20–50 workstreams of
wedding preparation — seeing every workstream's progress at a glance and
advancing each one step by step.

---

## Users and access

- **2–6 people**, all trusted (the couple plus a few helpers).
- Every user has **equal access** — no roles, no permissions, no admin. Roles
  are premature for 2–6 trusted users; future candidates are admin +
  workstream-owner.
- Identity comes from **Google OAuth** (Google Identity Services). A user is
  identified by their Google email address.
- Access is gated **outside the app**: a static allow-list of email addresses
  (environment config). There is no in-app user management — adding or removing
  someone means updating the allow-list. Managing access in the OAuth
  console/config avoids building whitelist CRUD for a handful of users.
- A User record is created automatically on **first login** (email, display
  name, avatar from Google). Users become assignable as owners from that point.
  The 2–6 people all sign in early, so "assignable only after login" is barely
  a constraint.

---

## Core concepts

### Project

A top-level container. All Workstreams belong to a Project. In V1 exactly one
Project exists (the wedding), but "wedding" is never hardcoded — the model uses
the generic name "Project." Only one exists, but the seam keeps the model
reusable and avoids a later migration.

A Project has:

- **Name.**
- **Event date** (optional) — the wedding day. Powers a global "N days to go"
  countdown on the overview and is often the last step's deadline. Nullable so
  the model works without one.

A Project has no owner and no per-project User membership in V1. Access is
external and all-equal, so there's no owner to model; one Project means Users
are effectively global.

### Workstream

A named track of preparation work — "Venue", "Catering", "Flowers", etc. Each
Workstream contains an **ordered pipeline of Steps** with a current-position
pointer. Every work item is a Step inside a Workstream — there are no standalone
tasks. One consistent model avoids orphan work with no pipeline context.

A Workstream has:

- **Name.**
- **Icon** — for quick visual identification on the overview.
- **Group** (optional) — a single group for visual clustering. A Workstream may
  be ungrouped; forcing a group on creation is friction.
- **Default owner** (optional) — a User. Steps inherit this owner unless they
  override it. This avoids repeating the same owner on every step.

### Step

An individual action within a Workstream's pipeline. Steps are **strictly
ordered** by position. Wedding prep is largely sequential; "advance" is the
core interaction.

A Step has:

- **Name.**
- **Owner** (optional) — a User; single owner for clear accountability. If
  unset, inherits the Workstream's default owner. If neither is set, the step
  is unassigned.
- **Deadline** (optional) — a date. Any step with a deadline is implicitly a
  milestone; there is no separate milestone concept — a separate flag would be
  redundant.
- **Blocked flag** — an informational boolean, meaningful only while the step is
  current. Does **not** prevent advancing (see No hard gates below).
- **Note log** — a thread of timestamped text entries (see Notes below).
- **Checklist sub-items** (optional) — lightweight child items (see Checklist
  Steps below).

A Step does **not** store its status — status is derived from the step's
position relative to the pipeline pointer. This makes illegal states (two "In
Progress" steps, a gap, an outcome on a future step) unrepresentable rather
than merely discouraged.

### Checklist Step

Not a separate type — a Step is a checklist iff it has ≥1 sub-item. There is no
discriminator flag. An intended-but-empty checklist is indistinguishable from a
normal step; an explicit discriminator would force every consumer to branch on
it for no behavioral difference.

This is the escape hatch for unordered work within a pipeline step (e.g. "Visit
venues" → { Chateau A, Chateau B, Chateau C }). There is no separate "unordered
workstream mode" — one pipeline model with a checklist escape hatch is simpler.

Sub-items are lightweight:

- **Name** + **done/skipped toggle.** That's it — no owner, no deadline, no
  attachments. Full step machinery would be unnecessary for sub-items.
- Sub-item progress is **informational**: it is shown at a glance but does
  **not** gate advancing. Consistent with the no-hard-gates stance — the tool
  informs, never obstructs.

### Group

A visual/organizational label used for clustering Workstreams on the overview.

A Group has:

- **Name.**
- **Color** — defined once on the Group, not repeated per Workstream.

Groups carry no behavior and no roll-up status. They exist for sorting and
visual grouping only — clustering and sorting on the overview is the entire
purpose.

### Note entry

A text entry in a Step's note log.

- Authored by a User, timestamped.
- The log is a **thread** (append-only sequence), not a single overwritable
  field. Preserves the structure and history of decisions and interactions.
- An author may **edit or delete their own** entries. No one else can. Low
  complexity (author-guarded edit); the trusted 2–6 user context doesn't need
  an immutable audit log.
- URLs in a note render as **clickable links** — there is no separate Link
  entity. One fewer entity and CRUD surface; a note already carries the label
  as text, and editable notes let you fix a dead URL. External resources (Drive
  docs, vendor sites, contracts) are referenced by URL inside notes.
- No file uploads in V1 — links only. Uploads add storage and complexity; URLs
  cover Drive docs, vendor sites, and contracts.

---

## Statuses and lifecycle

### Step status (derived, never stored)

A Step's status is derived from its position relative to the Workstream's
current-position pointer. Storing a full status enum per step would require
enforcing "exactly one In Progress, all before it resolved, all after it
not-started" on every write. A pointer makes that invariant structural.

| Status      | Meaning                                                       |
| ----------- | ------------------------------------------------------------- |
| Not Started | Ahead of the pointer — future work                            |
| In Progress | At the pointer — the step being worked on right now           |
| Done        | Behind the pointer, completed — completion date auto-recorded |
| Skipped     | Behind the pointer, bypassed — date auto-recorded             |
| Blocked     | The current step with its `blocked` flag set — informational  |

This is the minimal set covering pipeline position plus exceptions.

### Workstream lifecycle (derived from timestamps)

A Workstream moves through three states. The lifecycle is derived from a
timestamp pair (`startedAt`, `completedAt`), never stored as an enum — the enum
is fully derivable from the pair, so storing it would be redundant and
drift-prone. The pair also disambiguates the two "no current step" cases
(NotStarted vs Complete) that a lone nullable pointer would conflate, and
`startedAt` is genuinely useful data ("kicked off Venue three weeks ago").

| State      | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| NotStarted | Created but not begun — no current step, visible on the overview as "untouched" |
| Active     | Work underway — exactly one current step                                        |
| Complete   | Every step has been passed — completion date recorded                           |

NotStarted is a **visible** status on the overview. "We haven't even opened
Flowers yet" is a useful glance signal for wedding prep.

Transitions are **forward-only**:

- **NotStarted → Active**: the `start` action. Sets the first step as current.
  `start` is a real transition, not a special case of advance — the first move
  records no outcome (nothing has finished), so it is genuinely different from
  a step-to-step advance. Modelling it separately is cleaner than overloading
  `advance` with a "were we NotStarted?" branch.
- **Active → Active**: the `advance` action. Records the current step's outcome
  and moves the pointer to the next step.
- **Active → Complete**: the `advance` action on the last step. Records the
  outcome, clears the pointer, records the completion date.

There is no backward move. There is no undo in V1.

---

## Actions

### Start a Workstream

- Moves a Workstream from NotStarted to Active.
- Sets the first step as the current step.
- Valid **only** when the Workstream is NotStarted.
- An empty Workstream (zero steps) **cannot be started** — rejected with a
  conflict error. Completing with zero work done would mask a setup mistake;
  add at least one step first.

### Advance a Workstream

The primary and most frequent user action.

- `advance` is a **single action** taking an outcome — **Done** (default) or
  **Skipped**. Done vs Skipped is information about how a step ended, not
  control flow — both simply move the pointer forward. There is no separate
  "skip" action and no persistent "pre-skipped" flag. Collapsing them avoids a
  limbo "pre-marked skipped but still current" state.
- On the **last step**, completes the Workstream instead.
- Valid **only** when the Workstream is Active.
- Completion dates are recorded **automatically** when a step is marked Done or
  Skipped.

**No hard gates — advance is always permitted from Active:**

- A `blocked` flag on the current step does not prevent advancing. The user
  simply picks an outcome (Done or Skipped) and moves on. Soft-flag and
  hard-gate collapse to the same behavior — advancing forces a Done/Skipped
  choice either way.
- Unresolved checklist sub-items do not prevent advancing. They freeze as-is.
- The tool **informs**, it does not **obstruct**. For 2–6 trusted users,
  enforcement is friction with no payoff.
- The only rejection path is "not currently Active" (calling `advance` on a
  NotStarted or Complete Workstream, or `start` on a non-NotStarted one).

### Edit the pipeline

What can be changed depends on where a step sits relative to the pointer. You
re-plan the part you haven't done yet (that's what you learn as you go); the
past is settled history. This also guarantees the pointer is never invalidated
by a structural edit.

| Zone    | Add / delete / reorder | Edit attributes (name, deadline, owner, blocked, sub-items) | Append a note |
| ------- | :--------------------: | :---------------------------------------------------------: | :-----------: |
| Past    |         Frozen         |                           Frozen                            |      Yes      |
| Current |         Frozen         |                             Yes                             |      Yes      |
| Future  |          Yes           |                             Yes                             |      Yes      |

- **Past steps are frozen.** The only mutation allowed is appending a note.
- **The current step is editable** (name, deadline, owner, blocked flag,
  checklist sub-items, notes) but cannot be moved or deleted.
- **Future steps are fully mutable** — add, delete, reorder, edit freely.
- A step you decide never to do is **deleted** (it's a future step), not
  pre-skipped.

### Manage notes

- Add a note to any step (past, current, or future).
- Edit or delete your own notes. You cannot edit or delete someone else's notes.
- URLs in note text render as clickable links.

### Manage checklist sub-items

- Add, remove, or toggle (done/skipped) sub-items on the **current or future**
  steps only.
- Sub-items on past steps are frozen.

---

## Cross-workstream concerns

### Dependencies

**No structured dependencies in V1.** The need is unproven at 2–6 users, and
the blocked flag + note already says "blocked by step X of Workstream Y" in
words. Adding structured dependencies (workstream- or step-level) would be a
cheap migration once the lack is actually felt.

Cross-workstream waits are expressed informally: flag the current step as
`blocked` and add a note naming the blocker. This is a human convention, not
enforced by the system.

### Parallelism

Handled at the Workstream level — separate Workstreams run independently.
Within a pipeline, steps are strictly sequential. Intra-pipeline parallel steps
would add complexity; separate Workstreams plus informal dependencies cover
the real cases. Checklist sub-items cover unordered sub-tasks within a single
step.

### Notifications

**Pull-only in V1.** No email, no push notifications. Users check the overview;
deadlines already surface as countdown badges. Avoids email/scheduling
infrastructure for a handful of users.

---

## The overview — the only screen

V1 has a single screen: the **Pipeline Stack overview.** A two-panel layout
chosen over alternatives in the wireframe prototype. The overview shows each
Workstream as its full pipeline, color-coded by status — all work and its status
at a glance.

### Left panel — workstream card list

A scrollable list of Workstream cards, grouped by Group with section headers.

**Header bar:**

- Project name.
- **Global countdown**: "N days to go" (days until event date). Hidden if no
  event date is set.
- **Filter by owner**: dropdown to show only workstreams where the current
  step's owner matches the selected user, or "All."
- **Filter by group**: dropdown to show/hide groups.

**Each Workstream card shows:**

- Icon + name + owner avatar.
- **Deadline countdown badge**: the nearest upcoming deadline for that
  workstream, shown as "{step name} in {N}d". Deadlines surface as a per-card
  countdown badge plus date-ticks under the relevant step dots — not on a
  shared time axis (a shared axis didn't scale to 20–50 rows; per-card
  countdown reads clearer).
  - **Comfortable** (≥ 7 days): grey badge.
  - **Urgent** (< 7 days): red badge with warning.
  - **Overdue**: solid red badge, "{step name} {N}d overdue."
  - No upcoming deadlines: badge hidden.
- **Pipeline dots**: a horizontal row of circles representing each step,
  color-coded by status (green = Done, blue = In Progress, grey outline = Not
  Started, dashed = Skipped, red = Blocked). Steps with deadlines show the date
  below the dot.
- **Advance button**: one-click advance directly from the card — the most
  frequent action kept to one click. For blocked steps, this becomes a "Resolve"
  dropdown offering "Mark Done" / "Mark Skipped." Richer edits (notes, owner,
  deadline) live in the detail panel.

**Card visual states:**

- Default: neutral border.
- Selected (detail panel open): blue border, light blue background.
- Blocked: red border, light red background, "BLOCKED" badge.
- Overdue: red border, light red background.

**NotStarted Workstreams** are visible on the overview (not hidden).

### Right panel — detail slide-over

Opens when a card is clicked (not on the Advance button). Shows full detail for
one Workstream. A slide-over panel (not a separate page or inline expand) keeps
overview context visible while drilling into one Workstream.

Contains:

- **Vertical step pipeline**: each step as a vertical list item with connecting
  lines. Done steps show strike-through + completion date. Current step is
  highlighted with a "CURRENT" badge. Steps with deadlines show the date and
  relative countdown.
- **Checklist card** (if the current step has sub-items): inline display of
  sub-items with checkboxes and completion count ("2/4").
- **Note log**: reverse-chronological thread of timestamped entries. "+ Add
  note" action.
- Close button dismisses the panel; clicking another card swaps.

### Interactions summary

| Action                       | Where                   | Behavior                                                 |
| ---------------------------- | ----------------------- | -------------------------------------------------------- |
| Advance a workstream         | Card (Advance button)   | Records outcome, moves pointer. One click for Done       |
| Resolve a blocked workstream | Card (Resolve dropdown) | Choose Done or Skipped, then advances                    |
| Start a workstream           | Card or detail panel    | Transitions from NotStarted to Active                    |
| View workstream detail       | Click card body         | Opens slide-over panel on the right                      |
| Add a note                   | Detail panel            | Appends to the step's note thread                        |
| Edit/delete own note         | Detail panel            | Inline on the author's entries                           |
| Toggle checklist sub-item    | Detail panel            | Marks sub-item done/skipped (informational)              |
| Filter by owner              | Header dropdown         | Filters card list to matching workstreams                |
| Filter by group              | Header dropdown         | Shows/hides groups                                       |
| Edit step attributes         | Detail panel            | Name, deadline, owner, blocked — current and future only |
| Add/delete/reorder steps     | Detail panel            | Future steps only                                        |

---

## Edge cases and specific behaviors

### Advancing from Blocked

Blocked is informational. When the current step is flagged blocked, the card
shows a "Resolve" dropdown instead of a plain "Advance" button. The user picks
an outcome (Done or Skipped) — the step is recorded with that outcome and the
pointer moves forward. The blocked flag does not need to be explicitly cleared
first.

### Advancing past an incomplete checklist

Sub-item progress is informational. If a checklist step has unresolved
sub-items, advance proceeds normally. The sub-items freeze in their current
state as part of the step's history.

### Empty Workstream

A Workstream with zero steps **cannot be started** — the system rejects the
attempt with a conflict error. Completing with no work done would mask a setup
mistake; the user must add at least one step before starting.

### Last step has no deadline

A soft convention: the last step of a Workstream _should_ carry a deadline so
the Workstream has a target date. The system surfaces Workstreams without a
terminal deadline as a **nudge** ("needs a date"), but does not enforce it. The
"last step" moves as future steps are edited, so enforcing a deadline on it
would create friction as the pipeline is re-planned.

### Ownership inheritance

If a Step has no explicit owner, it inherits the Workstream's default owner. If
neither is set, the step is unassigned. Inheritance is resolved at read time,
not stored.

### Mis-click on Advance (no undo)

The pointer only moves forward. An accidental advance is not reversible in V1.
This is a known trade-off — accepted for the trusted-user context. If it bites,
the smallest future fix is an "undo last advance" that re-opens the most recent
step (un-records its outcome, moves the pointer back).

### Deadline countdown edge cases

- **Multiple deadlines in a Workstream**: the card badge shows the **nearest
  upcoming** deadline only.
- **All deadlines passed**: badge shows the most recently overdue one.
- **No deadlines at all**: badge hidden.
- **Urgency threshold**: 7 days. Below 7 days = urgent (red). At or above 7
  days = comfortable (grey). Overdue = solid red.
- **Event date countdown**: the global "N days to go" in the header is
  independent of per-step deadlines. It counts down to the Project's event date.

### Filter behavior

- **Filter by owner**: shows Workstreams where the **current step's effective
  owner** (after inheritance) matches the selected user. Workstreams with no
  current step (NotStarted or Complete) are excluded from owner filtering unless
  "All" is selected.
- **Filter by group**: shows or hides entire Groups. Ungrouped Workstreams are
  always visible (or have their own "Ungrouped" section).

### Note editing

- Authors can edit or delete their own notes. Edited notes show an "edited"
  indicator with an updated timestamp. Deleted notes are removed (not
  soft-deleted).
- Other users' notes are read-only.

### Creating and editing Workstreams and Groups

Workstreams and Groups can be created, edited, and deleted. The detail panel (or
a settings/management view — V1 does not prescribe where) supports:

- Creating a Workstream: name, icon, optional group, optional default owner.
- Editing a Workstream: name, icon, group, default owner.
- Deleting a Workstream: removes it and all its steps.
- Creating/editing/deleting Groups: name, color.

---

## What V1 does not include

These are explicitly **out of scope** — not forgotten, not deferred-until-later-
in-V1, but ruled out of this version:

| Excluded feature              | Why                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| File uploads                  | URLs in notes cover Drive docs, vendor sites, contracts; uploads add storage/complexity |
| Roles or permissions          | 2–6 trusted users; roles are premature                                                  |
| Push notifications            | Pull-only via overview countdown badges; avoids email/scheduling infra                  |
| Structured dependencies       | Unproven need; blocked flag + note is sufficient; cheap migration if needed later       |
| Undo / backward movement      | Accepted trade-off for simplicity; smallest future fix is "undo last advance"           |
| Multi-project / multi-wedding | One Project exists; the seam is there but not surfaced                                  |
| Enforced checklists           | Consistent with no-hard-gates — tool informs, never obstructs                           |
| In-app user management        | Allow-list in env config avoids building whitelist CRUD for a handful of users          |
| Responsive / mobile layout    | Desktop-first; tablet/mobile is not a V1 target                                         |
| i18n                          | Language decision (French vs English) deferred; template has i18n wired                 |

---

## Decision log

Decisions whose rationale is fully captured inline above are not repeated here.
This table covers **superseded decisions** and minor choices that didn't fit
naturally into the behavioral sections.

| #   | Decision                                                           | Status / note                                                                |
| --- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 11  | Dependencies are visual-only, no enforcement                       | Deferred out of V1 — superseded by Decision 36 (no dependency entity at all) |
| 12  | Dependency granularity is Workstream → Workstream                  | Deferred out of V1 — superseded by Decision 36                               |
| 14  | Deadline-steps anchored on a shared time axis                      | Superseded by Decision 24 — a shared axis didn't scale to 20–50 rows         |
| 19  | Access control via in-app email whitelist, not Google Groups       | Superseded by Decision 26 — access gated outside the app entirely            |
| 23  | Dependencies shown as a "depends on" text list in the detail panel | Deferred out of V1 — superseded by Decision 36                               |
| 25  | Each Workstream has an icon                                        | Settled; representation (emoji vs icon set) to be decided during UI build    |
