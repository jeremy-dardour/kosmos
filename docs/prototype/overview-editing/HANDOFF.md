# Handoff — inline overview editing

**Status:** design settled, ready to productionalise. Nothing here is
production code.

This branch contains one throwaway prototype that answers a single question and
records the answer. It is evidence, not an implementation. The next worker
rewrites the behaviour through production modules and deletes the prototype.

---

## 1. The question and the answer

> Can every Workstream / Step / checklist / note edit happen **inline in the
> overview list itself — with no side panel at all** — without wrecking
> scanability?

**Yes.** Four iterations were run; the winner is a card that _is_ its own
editor. There is no detail panel, no edit mode, and no Save button.

This **supersedes the two-panel "Pipeline Stack" layout** that the V1 PRD still
describes (see §5 — the PRD needs updating).

## 2. How to run it

Ports are workspace-specific — read them per [PORTS.md](../../../PORTS.md)
(`WEB_PORT` in `apps/web/.env`, `PORT` in `apps/api/.env`).

```
http://localhost:<WEB_PORT>/?variant=A
```

`?variant=A` is the only seam: it swaps the overview body for the prototype and
hides the detail panel. Without it the production overview renders untouched.

**Everything you type is a local draft.** Reads are real API data; no write ever
leaves the browser. The strip at bottom-left counts local edits.

Two things to know before judging it:

- The dev DB has only two or three active workstreams, so editable states are
  thin. Re-seeding makes the comparison sharper.
- Loading the page trips the API rate limiter (see §4.1). Reload twice in a
  minute and you get `ThrottlerException`.

## 3. Frontend decisions taken

### 3.1 Structure

| Decision                                                                                                           | Why                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **No side panel.** Editing happens in the card.                                                                    | Earlier iterations kept a panel; editing felt like it happened _next to_ the overview instead of _in_ it. |
| **No edit mode, no Save.** Card chrome is live fields; changes commit immediately.                                 | An explicit mode was tried (variant B) and lost — see §4.                                                 |
| **One step editor at a time, one card at a time**, opening as a strip anchored under the clicked dot with a caret. | Keeps the list scannable; the caret makes the dot→editor link obvious.                                    |
| **List capped at `max-w-[110rem]`**, using the width the dropped panel freed.                                      | Open question — see §5.                                                                                   |

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
  drop border and surface and sit flat. Selecting anything restores the frame.
  Idle borders are `transparent`, not absent, so nothing shifts by a pixel.
- **Settled steps recede** (`opacity-55`, full on hover) so a card reads as
  "here and ahead" rather than a wall of green.
- A **selected complete workstream stays recessive** — only the frame, the
  opened step and the editor light up. The dimming had to move off the card root
  onto its parts, because a parent `opacity` cannot be undone by a child.
- Reinforcing signals: darker connector rail for live pipelines, solid vs muted
  name, "Not started" as a filled chip. **Complete stays plain text** — it is
  the state that should recede.
- **Within a group, workstreams sort active → not started → complete.** Stable
  sort, so alphabetical order holds inside each tier.

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

## 4. Rejected ideas

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
| **A "Bare" chrome applied to every card regardless of lifecycle**    | Live and complete work became indistinguishable. Chrome now follows lifecycle instead.                                        |
| **Framed title pill** (name + group + status in a bordered chip)     | With the card already carrying a frame it was one border too many.                                                            |
| **"Step after" button in the step editor**                           | Replaced by hover `+` between dots — the insertion point should be the place you are pointing at.                             |

## 5. Backend assumptions and required changes

**No backend code was changed on this branch.** Everything below is a
requirement the production implementation must satisfy.

### 5.1 The overview aggregate carries no note data — blocking

Per-step markers need a note count for **every step of every workstream**. The
prototype gets this by calling `GET /api/workstreams/:id/notes` once per card.

**This is not viable.** With 8 workstreams a single page load fires ~11 requests
against a 30-per-minute throttle
(`apps/api/src/app/config/security.config.ts`); two or three reloads return
`ThrottlerException: Too Many Requests`. This was hit repeatedly during review —
it is measured, not theoretical.

Pick one before building:

1. **Add `noteCount` to the step DTO on the overview aggregate** (preferred —
   one extra count per step, no new round trips), or
2. fetch a thread only when a marker is expanded, and render the marker from a
   count that still has to come from somewhere.

### 5.2 The save model is unresolved — blocking

The prototype autosaves ("Saved as you type") because a local draft is free.
Production has no such endpoint shape:

- `PUT /api/workstreams/:id/pipeline` is an **atomic whole-tail replace with an
  optimistic-concurrency token** (`expectedUpdatedAt`), designed for one Save
  after a deliberate edit session.
- Autosaving every keystroke against it means frequent full-pipeline PUTs and a
  concurrency token that goes stale constantly.

Decide between: debounced whole-pipeline PUT with token refresh; granular
per-field step endpoints; or reintroducing an explicit Save for structural
changes only while field edits stay immediate. **This choice shapes the whole
implementation** — settle it first.

### 5.3 Endpoints that already exist and need no change

- `PATCH /api/checklist-items/:id` — the ghost checklist ticks in place.
- Note CRUD from #22 — `NoteDto.author.id` already carries what authorship
  rules need.
- `PATCH /api/workstreams/:id` — inline name / icon / group / owner edits.

### 5.4 Not a backend concern but easy to miss

- The theme ships **three** urgency tokens; the five-band scale needs **orange
  and yellow tokens for light and dark**. The prototype uses Tailwind defaults
  as a stand-in.
- Workstream sorting is done client-side; server-side ordering would work too.

## 6. What remains before this can close

Roughly in order:

1. **Settle §5.2 (save model) and §5.1 (note counts).** Everything else depends
   on these.
2. **Add the two urgency colour tokens** to `apps/web/src/main.css`, light and
   dark.
3. **Rewrite the prototype through production modules.** It is one ~1900-line
   file with no component boundaries; `PipelineEditor` is already oversized, so
   plan the seams before moving code.
4. **Delete the prototype**: `overview-editing-prototype.tsx` and the
   `?variant=A` seam in `overview-page.tsx`.
5. **i18n** — all copy is hardcoded English.
6. **Error handling** — the prototype has none. Problem Details, stale-save
   conflict, and never silently discarding user input.
7. **Tests** — Testing Library + MSW integration coverage per the web testing
   standard. No Playwright.
8. **Accessibility pass** — keyboard reachability of the hover `+`, the note
   markers and the dot buttons; accessible names; focus management when a step
   editor opens and closes.
9. **Mobile.** Untouched here. The ghost checklists and the wide dot columns
   need a narrow-screen answer.
10. **Update the specs.** [V1 Product PRD](../../specs/v1-product/PRD.md) still
    describes "a two-panel layout"; the api-contract PRD references the Pipeline
    Stack. Both need rewording to the single-column inline design.

## 7. Details worth knowing

- **Keep the page router-free.** An earlier iteration used `useSearchParams` in
  `OverviewPage` and broke 46 web tests — the test harness renders the page
  without a Router. The prototype reads `globalThis.location.search` directly.
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
- The prototype **restored future-tail reordering** that only the deleted
  variants B and C had, so the pipeline rules it claims to respect all hold.

### Reviewed and explicitly kept

The ghost checklist under the current and next step's dots — up to three items,
tickable in place on the current step, read-only at 40% opacity on the next.

### Still open (design, not blocking)

- Is `max-w-[110rem]` right? Sparse 3-step pipelines spread their dots very far
  apart at full width.
- Should the next step's checklist preview be tickable, or stay read-only?

## 8. File map

| File                                                            | Role                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/web/src/features/overview/overview-editing-prototype.tsx` | The whole prototype. Delete after absorption.                                           |
| `apps/web/src/features/overview/overview-page.tsx`              | Modified: the `?variant=A` seam. Revert after absorption.                               |
| `docs/prototype/overview-editing/HANDOFF.md`                    | This document.                                                                          |
| `docs/prototype/timeline/`                                      | The superseded two-panel wireframe. Kept because the PRDs still link to it — see §6.10. |
