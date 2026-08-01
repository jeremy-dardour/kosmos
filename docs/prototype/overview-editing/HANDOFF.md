# Handoff — inline overview editing

**Status:** design settled, ready to productionalise. Nothing here is
production code.

This branch contains one throwaway prototype that answers a single question and
records the answer. It is evidence, not an implementation. The next worker
rewrites the behaviour through production modules and deletes the prototype.

Tracked by [#40](https://github.com/jeremy-dardour/wedding-planner/issues/40),
which consolidates #35, #39, #41 and #43.

**Start with §4 if you are estimating** — several shipped capabilities, including
the product's primary action, have no home in the prototype yet. The exhaustive
behaviour spec is the appendix at the end.

---

## 1. The question and the answer

> Can every Workstream / Step / checklist / note edit happen **inline in the
> overview list itself — with no side panel at all** — without wrecking
> scanability?

**Yes.** Four iterations were run; the winner is a card that _is_ its own
editor. There is no detail panel, no edit mode, and no Save button.

The V1 PRD and the api-contract PRD have been updated to describe this design,
and the superseded two-panel wireframe (`docs/prototype/timeline/`) is deleted —
it is in git history if you need it.

A **second prototyping pass** (2026-07-31) answered five follow-up questions on
top of the settled layout: a collapsed **Completed section** at the page
bottom, **manual drag & drop ordering** of workstreams and groups (replacing
the lifecycle auto-sort), the home of **Advance / Start / Resolve** (§4.1 — now
answered), larger step titles, and a per-step **owner-override marker**. Each
is recorded in §3.6–§3.8 and the appendix.

## 2. How to run it

**The prototype and its `?variant=A` seam were deleted in C18** once the
inline overview became the production surface — the behaviour it demonstrated
now runs at the app root. Historically, `?variant=A` swapped the overview body
for the prototype (a local-draft-only surface: reads were real API data, no
write ever left the browser).

Two things to know before judging it:

- The dev DB has only two or three active workstreams, so editable states are
  thin. Re-seeding makes the comparison sharper.
- Loading the page trips the API rate limiter (see §6.1). Reload twice in a
  minute and you get `ThrottlerException`.

## 3. Frontend decisions taken

### 3.1 Structure

| Decision                                                                                                           | Why                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **No side panel.** Editing happens in the card.                                                                    | Earlier iterations kept a panel; editing felt like it happened _next to_ the overview instead of _in_ it. |
| **No edit mode, no Save.** Card chrome is live fields; changes commit immediately.                                 | An explicit mode was tried (variant B) and lost — see §5.                                                 |
| **One step editor at a time, one card at a time**, opening as a strip anchored under the clicked dot with a caret. | Keeps the list scannable; the caret makes the dot→editor link obvious.                                    |
| **List capped at `max-w-[110rem]`**, using the width the dropped panel freed.                                      | Open question — see §9.                                                                                   |

### 3.2 Deadlines

- **Five urgency bands**, not the shared three: `passed` / `week` (<7d) /
  `fortnight` (<14d) / `month` (<30d) / `far` (≥30d). A step due tomorrow and
  one due in five months both read as "not late" under the three-band scale.
- Each band drives **the dot's ring and its date label together** — the ring
  reads `currentColor`, so one class does both. Red → orange → yellow → grey.
- **Every dated step ahead of the pointer is ringed**, not just the workstream's
  nearest deadline, so a cluster of upcoming work is visible at once. A settled
  step's deadline is history and stays muted; a complete pipeline gets no rings.
- **The workstream's nearest deadline sits top-right of the card**, names its
  step, and reads `303d late` / `today` / `tomorrow` / `in 5d` / `12 Sep`.
- Dates keep the **year when it is not the current one** — without it a 2025
  deadline rendered as `1 Oct` and looked like a future date.

### 3.3 Notes

- **A marker under each step that has notes**, opening that step's thread
  anchored under its dot. Notes are a property of the pipeline, not a card
  footer — this is the only treatment that reaches a **past** step's thread.
- The marker sits between the step label and the ghost checklist, so a step can
  show **date, marker and checklist at once**.
- **The step editor always shows notes**, expanded, with add / edit / delete.
- **Authors may only revise their own entries** (`note.author.id` against the
  signed-in user), and a past step's thread is **append-only**.

### 3.4 Lifecycle legibility

- **Chrome follows lifecycle**: live workstreams are framed cards; complete ones
  keep a **light half-strength frame** (no surface, no shadow) — fully
  transparent chrome made them invisible in review. Selecting anything restores
  the full frame.
- **Settled steps recede** (`opacity-55`, full on hover) so a card reads as
  "here and ahead" rather than a wall of green.
- A **selected complete workstream stays recessive** — only the frame, the
  opened step and the editor light up. The dimming had to move off the card root
  onto its parts, because a parent `opacity` cannot be undone by a child.
- Reinforcing signals: darker connector rail for live pipelines, solid vs muted
  name, "Not started" as a filled chip. **Complete stays plain text** — it is
  the state that should recede.
- ~~Within a group, workstreams sort active → not started → complete.~~
  **Superseded by manual ordering (§3.6)**: within a group, live cards sit
  exactly where the user put them. The only automatic movement left is
  completion, which moves the card into the Completed section (§3.7).

### 3.5 Pipeline structure editing

- **Steps are inserted from the pipeline, not the editor.** A `+` appears on
  hover on the connector line between two dots; the trailing `+` is permanent.
- Legality is one expression: **`index > currentIndex`**. With no current step
  `currentIndex` is `-1`, so every position in a NotStarted workstream is
  offered; in an Active one only positions after the current step; a complete
  pipeline offers none.
- **Past steps are frozen** — name, deadline, owner read-only; checklist is a
  record; no reorder, delete or insert-after. Only notes may be appended.
- **Only the future tail reorders**; controls are absent (not disabled) on
  current and past steps.
- Checklist preview shows **unfinished items first** (three fit under a dot).
  The editor's full list keeps authored order so items do not jump as you tick.

### 3.6 Manual ordering (drag & drop)

Grilled and settled 2026-07-31:

- **Two drag levels**: workstreams reorder **within their own group**; whole
  groups reorder on the page. No cross-group card drags — group reassignment
  stays a deliberate act on the card's group chip.
- **Pure manual order** replaces the lifecycle sort. Position the user authored
  is stable; starting another workstream never reshuffles around it. A
  NotStarted card may sit above Active ones if that's where it was put.
- **New workstreams insert at the top of their group** (create endpoint shifts
  positions server-side).
- **Ungrouped is pinned last** (above Completed) and is not itself draggable —
  it is "not yet filed", not a peer group, and has no entity to store a
  position on. Cards inside it reorder normally.
- **Drag affordance: a grip handle at the top-left** of the card and of the
  group header, visible on hover/focus. Nothing else on the card initiates a
  drag — the title is a live text field and the card is dense with targets.
  A workstream **alone in its group gets no handle** (nothing to reorder).
- **Dragging is disabled while any filter is active** — reordering a filtered
  list is ambiguous (hidden cards sit between visible neighbours). The
  prototype has no filters, so this rule is production-only.
- Library: **dnd-kit** (`@dnd-kit/core` / `sortable` / `modifiers` /
  `utilities`) — keyboard-accessible sorting, distance-gated pointer sensor so
  plain clicks never start a drag.

### 3.7 Completed section

- Completed workstreams **leave their group** and sink into one section at the
  page bottom, **collapsed by default** behind a `✓ Completed (n)` header row
  with a chevron. The count alone carries the progress-feel.
- Inside, cards **cluster by group** in the same group order as the live list,
  each cluster under a small group header.
- Cards reuse the **recessive complete-card treatment unchanged** — fully
  interactive (open steps, read notes, append notes), never draggable.
- A group whose workstreams are all complete disappears from the live area.

### 3.8 The primary action on the card (B3 — answered)

- **Placement: in the header row, immediately right of the lifecycle badges**
  (`after-title`) — the eye lands on name → status → action in one sweep.
  Top-right and bottom-right were built and compared live; top-right collides
  with the deadline badge + owner cluster and bottom-right adds a footer row.
- **Form: the only solid button on the card** — that is what keeps it
  unmistakable among the quiet click targets. A split button: one-click
  **Advance** (Done), chevron dropdown for **Skip**.
- **Blocked current step**: the button becomes an outlined red **Resolve ▾**
  dropdown — advance as done, advance as skipped, or unblock and keep working.
  A blocked step never advances in one click; resolving means choosing.
- **NotStarted**: an outlined **Start** button, hidden when the pipeline is
  empty (nothing to start). **Complete**: no action at all.
- Misfire safety: the drag sensor's distance gate plus the dropdown for
  destructive-ish outcomes (Skip) keep accidental advances out.

## 4. What the prototype does NOT cover

Read this section before estimating. The prototype answers a **layout and
interaction** question; several shipped capabilities have no home in it yet.

### 4.1 Advance / Start / Resolve — the product's primary action

**Answered by the second pass — see §3.8 for the settled design** (after-title
placement, split button, Resolve dropdown, Start). The prototype's control
mutates the local draft only; production keeps the shipped command semantics.

What still holds from the original warning:
[project-purpose.md](../../project-purpose.md) says "the primary action is
'advance' a workstream to its next step", and production already ships it
(`workstream-card-action.tsx`, Slice 3 / #20) with **row-local pending state**
and descriptive Problem Details errors — the prototype models neither, and the
production rewrite must keep both. Advancing stays a single click and must
never require opening an editor first (PRD rule).

### 4.2 Everything else the prototype skips

- **Persistence.** Every edit is a local draft; nothing is written back.
- **Error handling.** None. No Problem Details, no conflict path, no retry.
- **i18n.** All copy is hardcoded English.
- **Mobile.** Never designed. The ghost checklists and the wide dot columns need
  a narrow-screen answer.
- **Tests.** None, by design.
- **Loading and empty states.** The prototype only renders once data has landed;
  `overview-skeleton.tsx` is untouched.
- **Workstream create / delete**, group management and project settings — the
  production dialogs still handle these and render unchanged behind the
  prototype.

### 4.3 What the prototype _does_ prove about the surrounding app

The prototype renders inside the **real** header, filters and dialogs, so those
are already known to compose with the new list: owner filter, group filter,
event countdown, and all four management dialogs work as-is.

## 5. Rejected ideas

Do not re-propose these without new information.

| Rejected                                                             | Why                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Two-panel layout with a detail panel** (iterations 1–2)            | Editing read as happening beside the overview, not in it.                                                                     |
| **Variant B — explicit edit mode + dense step table**                | Only variant showing a whole replan at once and the only one with a real discard, but its columns were unreachable on mobile. |
| **Variant C — card expands into a horizontally scrolling step lane** | Best use of width and survived mobile, but only ~3 step cards fit at 390px and long checklists made lane cards ragged.        |
| **Deadline diamond above the dot**                                   | Triple-encoded the same fact alongside the date tick and the card badge.                                                      |
| **Deadlines as card badge only** (no per-step signal)                | Too little; the pipeline lost all sense of timing.                                                                            |
| **Notes as a card footer for the current step only**                 | Cannot reach a past step's thread.                                                                                            |
| **Notes as a pinned "latest update" line per card**                  | Good for scanning "what happened lately", but duplicated the per-step thread and put an empty bar on every quiet card.        |
| **"Bare" chrome applied to every card regardless of lifecycle**      | Live and complete work became indistinguishable. Chrome now follows lifecycle instead.                                        |
| **Framed title pill** (name + group + status in a bordered chip)     | With the card already carrying a frame it was one border too many.                                                            |
| **"Step after" button in the step editor**                           | Replaced by hover `+` between dots — the insertion point should be the place you are pointing at.                             |

## 6. Backend assumptions and required changes

**No backend code was changed on this branch.** Everything below is a
requirement the production implementation must satisfy.

### 6.1 The overview aggregate carries no note data — settled

Per-step markers need a note count for **every step of every workstream**. The
prototype gets this by calling `GET /api/workstreams/:id/notes` once per card.

**This is not viable.** With 8 workstreams a single page load fires ~11 requests
against a 30-per-minute throttle
(`apps/api/src/app/config/security.config.ts`); two or three reloads return
`ThrottlerException: Too Many Requests`. This was hit repeatedly during review —
it is measured, not theoretical.

**Settled (2026-07-31): option 1.** `noteCount` joins the step DTO on the
overview aggregate; thread bodies stay on-demand. Note mutations patch the
cached count and invalidate the notes query — see the
[V1 API contract](../../specs/v1-product/api-contract.md).

### 6.2 The save model — settled (2026-07-31)

Full contract in the [V1 API contract](../../specs/v1-product/api-contract.md);
the decisions in short:

- **Save trigger**: text fields commit on blur/Enter ("saved when you leave
  the field", not per keystroke); pickers and toggles on selection; structural
  clicks immediately.
- **Granular endpoints replace the whole-tail PUT**: `PATCH /steps/:id`,
  `POST /workstreams/:id/steps`, `DELETE /steps/:id`,
  `PUT /workstreams/:id/step-order`, plus checklist item create/rename/delete.
  `PUT /workstreams/:id/pipeline` and its `expectedUpdatedAt` token are
  **removed**.
- **Concurrency**: field edits are last-write-wins; every operation
  re-validates the pipeline invariants server-side and 409s only on a real
  violation.
- **Refresh**: one aggregate read for load; each mutation response returns the
  smallest changed entity (StepDto for field edits, WorkstreamDto for
  structural/pointer ops) and is patched into the cached aggregate; a single
  trailing invalidate reconciles derived fields and is **deferred while any
  inline input has focus**. Raise the authenticated throttle (30/min →
  ~120/min).
- **New steps**: a clicked insert point opens a local ghost; the `POST` fires
  on the first non-empty name commit; empty names are rejected server-side;
  an illegal-by-then position 409s and discards the ghost with a message.

`useDraft` in the prototype is not a model for any of this — it snapshots the
server list on first edit and never resyncs. With commit-on-blur there are no
long-lived drafts left; the only protection production needs is that a
focused input is never clobbered by a refetch (keyed editors + the deferred
invalidate above).

### 6.3 Endpoints that already exist and need no change

- `PATCH /api/checklist-items/:id` — extended with rename, otherwise as-is.
- Note CRUD from #22 — `NoteDto.author.id` already carries what authorship
  rules need.
- `PATCH /api/workstreams/:id` — inline name / icon / group / owner edits.
- `POST /workstreams/:id/advance` and the start command — unchanged; their UI
  home is §3.8.

### 6.4 Manual ordering needs persistence — new since the second pass

Neither `Workstream` nor `Group` has a position today. Settled shape
(grilled 2026-07-31):

- **Integer `position` columns**: on `Workstream`, scoped to its group (the
  ungrouped bucket is its own scope); on `Group`, scoped to the project.
- **Full-ordered-list reorder endpoints**: one drag sends the whole ordered id
  list for that scope — `PUT /api/groups/:id/workstream-order { ids }`,
  `PUT /api/projects/:id/group-order { ids }` (plus a variant for the
  ungrouped scope). Atomic, idempotent; the server rewrites contiguous
  positions. Use the existing two-phase temporary-position pattern — the
  generated unique constraints are not deferrable.
- **Migration seeds positions from today's alphabetical order** so nothing
  visibly moves on upgrade.
- **Create inserts at position 0** (top of group), shifting server-side.
- Changing a workstream's group appends it to the target group's scope (top or
  bottom — implementer's choice, record it).

### 6.5 Not a backend concern but easy to miss

- The theme ships **three** urgency tokens; the five-band scale needs **orange
  and yellow tokens for light and dark** in `apps/web/src/main.css`. The
  prototype uses Tailwind defaults as a stand-in.

## 7. Bugs found in production while prototyping

Both are **live on `main`** and were only fixed inside the prototype.

1. **`in 0d`.** `overview.badge.upcoming` is `"{{name}} in {{count}}d"`, so a
   deadline due today renders "Tasting in 0d". The prototype reads `today` /
   `tomorrow` instead. Fixing this in production means changing the i18n strings
   in all three locales, which is why it was left alone here.
2. **Year-less dates.** Date ticks under the dots render `MM/DD`, so a deadline
   from a previous year reads as a future date — a 2025 deadline displayed as
   `1 Oct` while the card's badge said `303d late`. The prototype shows the year
   whenever it is not the current one.

## 8. What remains before this can close

Roughly in order:

1. **Build the API changes** — every decision is settled: `noteCount` on the
   aggregate (§6.1), the granular step/checklist endpoints replacing the
   whole-tail PUT (§6.2), and the throttle raise. Contract:
   [V1 API contract](../../specs/v1-product/api-contract.md).
2. **Build the ordering persistence** (§6.4) — position columns, reorder
   endpoints, migration.
3. **Add the two urgency colour tokens** to `apps/web/src/main.css`, light and
   dark.
4. **Rewrite the prototype through production modules** — see the component map
   in §10. It is one ~2000-line file with no component boundaries, and
   `PipelineEditor` is already oversized, so plan the seams first.
5. **Delete the prototype**: `overview-editing-prototype.tsx` and the
   `?variant=A` seam in `overview-page.tsx`.
6. **i18n** — all copy is hardcoded English.
7. **Error handling** — Problem Details, stale-save conflict, and never silently
   discarding user input.
8. **Tests** — Testing Library + MSW integration coverage per the web testing
   standard. No Playwright. Expect to rewrite the specs listed in §10.
9. **Accessibility pass** — keyboard reachability of the hover `+`, the note
   markers and the dot buttons; accessible names; focus management when a step
   editor opens and closes. **Every icon-only button carries a tooltip** (at
   minimum a native `title` mirroring its accessible name) — the add-step `+`,
   drag handles, note markers, icon picker, and the advance cluster.
10. **Mobile.**
11. **Fix the two production bugs in §7** while you are in this code.

## 9. Details worth knowing

- **Keep the page router-free.** An earlier iteration used `useSearchParams` in
  `OverviewPage` and broke 46 web tests — the test harness renders the page
  without a Router. The prototype reads `globalThis.location.search` directly.
  This also constrains the URL-addressability work carried into #40 from #41.
- **`DotCaret` mirrors the dot row's column widths**, including whether the
  trailing add-step column exists. Get that wrong and the caret drifts off its
  dot on complete workstreams.
- **Connector lines need `pointer-events-none`** — being absolutely positioned,
  they otherwise swallow clicks aimed at the hover `+`.
- **Click-away closes the editor**, but clicks inside a portalled picker
  (`role="menu" | "dialog" | "listbox"`) count as inside — otherwise choosing an
  owner dismisses the editor underneath.
- **A parent `opacity` cannot be undone by a child.** Dimming must live on the
  parts you want dimmed, never on a container whose children must stay bright.
- **DnD: apply `CSS.Translate`, not `CSS.Transform`.** The sortable transform
  carries a scale component that visibly deforms cards of different heights
  mid-drag.
- **DnD: one context per group for cards.** A single page-wide context made
  drags stutter against every foreign drop target; per-group contexts measure
  only siblings and enforce the within-group rule by construction. The outer
  group-reorder context nests around them without conflict because listeners
  live on the handles.
- **DnD: gate the pointer sensor by distance** (4px) or every click on the
  card's dense targets risks starting a drag; lock both contexts to the
  vertical axis (`restrictToVerticalAxis`) for continuity.
- **The clock is read at render** (`new Date()` behind an eslint-disable), in
  both the prototype and production's `deadline-badge.tsx`. Nothing refreshes at
  local midnight, so urgency bands can sit stale on a long-lived tab. Worth
  fixing centrally rather than per component.
- The prototype **restored future-tail reordering** that only the deleted
  variants B and C had, so the pipeline rules it claims to respect all hold.

### Reviewed and explicitly kept

The ghost checklist under the current and next step's dots — up to three items,
tickable in place on the current step, read-only at 40% opacity on the next.

### Still open (design, not blocking)

- Is `max-w-[110rem]` right? Sparse 3-step pipelines spread their dots very far
  apart at full width.
- Should the next step's checklist preview be tickable, or stay read-only?

## 10. Component map

Everything below lives in `apps/web/src/features/overview/`.

**Replaced by the new card** — behaviour moves inline; delete once absorbed:

| File                                                                   | Note                                        |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| `detail-panel.tsx`                                                     | The panel itself is gone.                   |
| `vertical-pipeline.tsx`                                                | Superseded by the horizontal editable dots. |
| `pipeline-editor.tsx`                                                  | Editing is per-step and inline now.         |
| `step-checklist.tsx`, `checklist-card.tsx`                             | Fold into the step editor + ghost preview.  |
| `step-notes.tsx`                                                       | Fold into the step editor + dot markers.    |
| `workstream-card.tsx`, `workstream-card-list.tsx`, `group-section.tsx` | Replaced by the new card and list.          |
| `pipeline-dots.tsx`                                                    | Replaced by the interactive dot row.        |
| `deadline-badge.tsx`                                                   | Replaced by the top-right badge (§3.2).     |

**Keep and extend:**

| File                         | Note                                                             |
| ---------------------------- | ---------------------------------------------------------------- |
| `workstream-card-action.tsx` | **Advance / Start / Skip / Resolve — must survive.** See §4.1.   |
| `urgency.ts`                 | Extend from three bands to five; production `daysUntil` is fine. |
| `group-workstreams.ts`       | Add the lifecycle tier sort (§3.4).                              |

**Keep unchanged** — already proven to compose with the new list:
`overview-header.tsx`, `owner-filter.tsx`, `group-filter.tsx`,
`filter-trigger.tsx`, `event-countdown.tsx`, `owner-avatar.tsx`,
`is-blocked-now.ts`, `days-until.ts`, `overview-skeleton.tsx`, and all four
dialogs (`workstream-form-dialog`, `group-manager-dialog`,
`project-settings-dialog`, `confirm-dialog`).

**Tests that will need rewriting** (in `__tests__/`): `workstream-card.spec`,
`pipeline-dots.spec`, `vertical-pipeline.spec`, `pipeline-editor.spec`,
`checklist-card.spec`, `pipeline-editing.integration.spec`,
`notes-actions.integration.spec`, `overview-integration.spec`. Keep
`workstream-card-action.spec` passing — if it breaks, the primary action broke.

## 11. File map

| File                                                            | Role                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------- |
| `apps/web/src/features/overview/overview-editing-prototype.tsx` | The whole prototype. Delete after absorption.             |
| `apps/web/src/features/overview/overview-page.tsx`              | Modified: the `?variant=A` seam. Revert after absorption. |
| `docs/prototype/overview-editing/HANDOFF.md`                    | This document.                                            |

---

# Appendix — complete behaviour specification

Everything the prototype defines, surface by surface. §3 says _what was decided
and why_; this says _what it does_. Where a rule restates a domain rule from
[CONTEXT.md](../../../CONTEXT.md), that is noted — those are not new.

## A1. The list

- Single column, centred, capped at `max-w-[110rem]`.
- Grouped by Group with a section header: drag handle (hover) · colour swatch ·
  group name · workstream count. Empty groups are dropped; ungrouped
  workstreams form a final "Ungrouped" section, pinned after the real groups.
- **Manual order at both levels** (A14). Groups start in the API's alphabetical
  order until dragged; workstreams keep the draft array order. No lifecycle
  sort.
- Only **live** (Active / NotStarted) workstreams render in the group
  sections; Complete ones render in the Completed section at the bottom (A15).
- The production header, owner filter, group filter and management dialogs
  render unchanged above it.

## A2. The card

- **Chrome by lifecycle**: live (Active/NotStarted) = border + surface + shadow;
  Complete = **half-strength border** (`border-border/50`), no surface, surface
  appears on hover; any card with an open step editor = accent border + surface
  - shadow.
- **Header row**, left to right: drag handle (hover; A14) · icon picker · name ·
  group chip · lifecycle badges · **advance control (A16)** · _(spacer)_ ·
  deadline badge · owner avatar · delete (bin icon, hover/focus-revealed like
  the drag handle, opens the existing confirm dialog; settled 2026-08-01 after
  the detail panel's removal orphaned deletion — not in the prototype).
- The header row is dimmed (`opacity-65`) when the workstream is Complete.
- Name is `font-semibold`/foreground when live, `font-medium`/muted when
  Complete.

### Header controls

| Control          | Behaviour                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Icon**         | Opens a 10-emoji grid; picking one sets the icon.                                                 |
| **Name**         | Click-to-edit in place. Enter commits, Escape cancels, blur commits. Empty renders "Untitled".    |
| **Group chip**   | Shows colour swatch + group name, or "No group". Opens a picker listing "No group" + every group. |
| **Owner avatar** | Opens a picker listing "Unassigned" + every user. Sets the Workstream's default owner.            |

### Lifecycle badges

- **Blocked** — red chip, shown when _any_ step in the pipeline is currently
  blocked (`isBlockedNow`).
- **Not started** — filled grey chip, uppercase.
- **Complete** — plain green text, uppercase, deliberately not a chip.

### Deadline badge (top-right)

- Rendered only when the workstream has a nearest-deadline step that resolves to
  a step with a deadline.
- Content: step name (truncated) + countdown.
- Countdown wording: `Nd late` (overdue) · `today` · `tomorrow` · `in Nd`
  (under 14 days) · otherwise a plain date.
- Dates render as `12 Sep`, gaining a 2-digit year (`1 Oct 25`) whenever the
  year is not the current one.
- Background/foreground follow the five-band scale (A6).
- Tooltip: `{step name} due {ISO date}`.

## A3. The pipeline row

Each step occupies an equal-width column containing, top to bottom: the dot, the
step name, its date, its note marker, its checklist preview.

- **Connector lines** join the dots, half-width either side, `pointer-events-none`.
  Live pipelines get a darker rail than Complete ones.
- **Dot size**: 14px normally, 20px for the current step and for any blocked
  step.
- **Dot appearance by status** (unchanged from production): Done = filled green ·
  In Progress = filled blue with glow · Not Started = outlined · Skipped =
  dashed outline · Blocked = filled red with glow, overriding the others.
- **Open step**: the dot scales up and takes an accent ring.
- **Hover**: the dot scales up.
- **Settled steps** (Done/Skipped) that are not open render at `opacity-55`,
  returning to full opacity on hover. They stay clickable.
- **Step name**: truncated, centred, **13px** (body-adjacent — the pipeline's
  labels must scan without leaning in). Semibold foreground when open or
  current, medium at 75% foreground otherwise, italic muted "Untitled" when
  unnamed.
- **Owner-override marker**: a small avatar (16px) under the step name,
  rendered **only when the step has an explicit owner** — inherited owners stay
  invisible here, so an avatar under a dot always means an override.
- The whole dot + label + date is one button carrying `aria-pressed`.

## A4. Per-step deadline signals

- A step with a deadline shows its date under the name.
- A step **still ahead of the pointer** (In Progress or Not Started) in a
  **non-Complete** pipeline also gets a ring on its dot.
- Ring and date share one colour per band, so they always agree.
- A settled step's date renders muted regardless of urgency — its deadline is
  history.
- A Complete pipeline shows dates but no rings.
- Tooltip on a ringed dot: `{status} · due {ISO date}`.

## A5. Note markers

- A step with one or more notes shows a marker under its date: a speech-bubble
  icon plus the count.
- The count includes notes added in this session.
- A step with no notes shows no marker.
- Clicking toggles that step's note panel; clicking the same marker again closes
  it. Only one panel at a time per card.
- The marker inverts (dark fill) while its panel is open, and carries
  `aria-pressed` plus an accessible name.
- Markers appear on **every** step including past ones — this is the only route
  to a past step's thread.

## A6. The five urgency bands

| Band        | Window    | Dot ring   | Date + badge |
| ----------- | --------- | ---------- | ------------ |
| `passed`    | overdue   | 3px red    | bold red     |
| `week`      | < 7 days  | 2px red    | medium red   |
| `fortnight` | < 14 days | 2px orange | orange       |
| `month`     | < 30 days | 2px yellow | yellow       |
| `far`       | ≥ 30 days | 2px muted  | muted 60%    |

Bands are computed from whole local calendar days (`daysUntil`).

## A7. Checklist preview under the dots

- Shown for the **current** step and the **next Not Started** step, and only
  while that step's editor is closed.
- Up to three items, **unfinished first** (stable, so authored order holds
  within each half), then `+N more`.
- The current step's items are **tickable in place** — a real write from the
  overview.
- The next step's items are read-only at 40% opacity.
- Done items render struck through and muted.

## A8. Step insertion

- A `+` appears on the connector line between two dots on hover of the pipeline
  row, and on keyboard focus.
- A permanent `+` sits at the end of the pipeline.
- An insertion point at index `i` is offered when **`i > currentIndex`**, where
  `currentIndex` is `-1` when there is no current step. In practice: every
  position in a NotStarted workstream, only positions after the current step in
  an Active one, none in a Complete one. _(Domain rule — CONTEXT.md "Step
  insertion zone".)_
- Clicking inserts a new empty step at that position and opens its editor with
  the name field focused.
- The insertion control is zero-width and absolutely positioned, so it never
  shifts the step columns.

## A9. The step editor

Opens beneath the clicked dot, with a caret pointing at it. One step at a time,
one card at a time.

### Header

`status dot · name · [CURRENT] or [DONE/SKIPPED] · deadline · owner · [blocked toggle]`

- **Editable step** (In Progress or Not Started): name is click-to-edit;
  deadline opens a date input; owner opens a picker whose "inherit" option
  clears the explicit owner. _(Domain rule — ownership inheritance.)_
- **Frozen step** (Done or Skipped): name, deadline and owner render as static
  text/avatar.
- The **blocked toggle** appears only on the current step, and is informational —
  it never gates anything. _(Domain rule.)_

### Checklist

- Shows `done/total` and the full item list.
- Editable step: toggle, add, and remove items.
- Frozen step: toggles disabled, no add, no remove — a record, not a working
  list.

### Notes

- Always visible, expanded by default.
- Collapsed summary line shows count, latest note, its author and relative time.
- Adding is allowed on **every** persisted step, including frozen ones.
- Editing and deleting are allowed only on **your own** entries, and never on a
  frozen step — a past thread is append-only.
- A newly inserted, unsaved step shows "Notes available once the step is saved"
  instead of a thread.

### Footer

| Control              | Availability                                                                |
| -------------------- | --------------------------------------------------------------------------- |
| Previous / next step | Navigates the editor along the pipeline; disabled at the ends.              |
| Move earlier / later | Only when the step **and** its neighbour in that direction are Not Started. |
| Delete               | Only when the step is Not Started. Closes the editor.                       |
| Close                | Always.                                                                     |
| Status text          | "Saved as you type" when editable, "Frozen — notes only" when not.          |

_(Reorder and delete restrictions are the domain's "only the future tail is
freely mutable" rule.)_

## A10. The note panel (opened from a marker)

- Anchored under its dot with the same caret as the step editor.
- Header: step name, note count, close button.
- Same thread and composer as the step editor, with the same authorship and
  append-only rules.
- Not rendered when that step's full editor is already open — the editor's own
  notes block covers it.

## A11. Note threads

- Order: existing notes as the API returns them, then notes added this session.
- Each entry shows author, relative time, and body.
- Relative time: `Nm ago` under an hour, `Nh ago` under a day, otherwise
  `Nd ago`. Notes added this session read "You · just now".
- Edit and delete controls appear on hover or keyboard focus, only where
  permitted.
- Editing is inline: Enter commits, Escape and blur cancel.
- The composer posts on Enter and clears; Escape closes the thread.

## A12. Opening and closing

- Clicking a dot opens that step's editor; clicking the same dot closes it.
- Clicking anywhere outside the card closes both the step editor and any open
  note panel.
- Clicks inside a portalled popup (`role="menu" | "dialog" | "listbox"`) count as
  inside the card, so using a picker never dismisses the editor beneath it.
- Selecting a step in another card closes the first — one open editor across the
  whole list.

## A13. Draft semantics (prototype-only)

Not a production model — recorded so its behaviour is not mistaken for a
requirement. Every mutation writes to an in-memory draft and increments a
counter; step positions are renumbered after any structural change; nothing is
ever sent to the API; the draft snapshots the server list on first edit and
never resyncs. See §6.2 for what production must do instead.

## A14. Manual ordering (drag & drop)

- A grip handle appears on hover/focus at the **top-left of a card** and at the
  **left of a group header**. Nothing else initiates a drag.
- Cards drag **vertically within their own group only**; each group is its own
  drag context, so foreign cards and groups are never drop targets. The
  dragged card floats at full strength with a shadow ring; the gap its
  siblings open is the drop indicator. Translation only — no scaling.
- Group headers drag **whole sections** vertically among the real groups.
  Ungrouped has no handle and never moves.
- A card alone in its group has **no handle**; single real groups still drag.
- Keyboard: the handles are buttons; dnd-kit's keyboard sensor picks up, moves
  and drops with arrow keys.
- Production additions the prototype skips: persistence (§6.4) and disabling
  drags while a filter is active (§3.6).

## A15. The Completed section

- Rendered after the last group section, only when at least one workstream is
  Complete.
- Header: chevron (rotates when open) · green check · "Completed" · count ·
  a hairline rule filling the rest of the row. The whole row is one button
  carrying `aria-expanded`. **Collapsed by default.**
- Expanded: completed workstreams cluster under small group headers, same
  group order as the live list, ungrouped last.
- Cards are the standard recessive complete cards — openable, notes appendable,
  not draggable, no advance control.
- A workstream completes → its card leaves the group section and appears here;
  there is no other route in (no undo in V1).

## A16. The advance control

- Lives in the header row, right of the lifecycle badges. The only solid
  button on the card.
- **Active, current step not blocked**: split button — `Advance` commits the
  current step as Done and moves the pointer; the chevron opens a menu with
  `Skip {step name}` (advance as Skipped).
- **Active, current step blocked**: outlined red `Resolve ▾` menu — advance as
  done, advance as skipped, or unblock and keep working.
- **NotStarted**: outlined `Start` (activates step 1); hidden when the
  pipeline has no steps.
- **Complete**: nothing rendered.
- Advancing the last step completes the workstream and moves the card to the
  Completed section immediately.
- Production must keep row-local pending state and Problem Details error
  surfacing from `workstream-card-action.tsx` (§4.1).
