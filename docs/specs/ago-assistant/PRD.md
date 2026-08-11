# AGO Assistant: Workstream Authoring — PRD

What the assistant does and why. The how — function schemas, context payloads,
implementation order — lives in
[authoring-build-plan.md](./authoring-build-plan.md).

## Context

Kosmos embeds an assistant, currently a trial of the [AGO](https://useago.com)
SDK on `feat/ago-sdk`. Today it can move between pages and list the user's
projects and a project's members. It cannot see a single workstream, and it
cannot change anything — it is a chatbot that happens to know the router.

Setting up a workstream is the longest, most tedious task in the product.
Creating one means naming it, picking an icon, then adding each step in turn
with its name, deadline and owner, then adding checklist sub-items to the steps
that need them. A six-step workstream is a dozen small interactions, all of
them typing. Every project starts with twenty to fifty of these.

That is the task worth handing to an agent: high effort, low judgment, entirely
expressible in a sentence or two of prose.

## Goals

1. **Author a workstream from a brief.** The user describes what they need in
   prose; the assistant produces the whole pipeline — steps, deadlines, owners,
   checklists — in a single turn.
2. **Give the assistant sight.** It knows what is in the project without being
   asked, so acting on "add a tasting step to Catering" costs no interrogation.
3. **Keep the user in control.** It proposes before it writes, the result lands
   on the overview where everything is already editable inline, and corrections
   happen there.
4. **Make it impossible to lose work.** Nothing the assistant can do destroys
   or reorders anything.

Not a goal: replacing inline editing. The overview stays the primary surface.
The assistant exists for the tedious bulk at the start, not for the ongoing
one-field-at-a-time work the overview already does well.

## Capability Surface

### Authoring a new workstream

The user describes a workstream in prose — _"set up catering for the wedding,
we need to shortlist places, do a tasting, sign, and confirm numbers"_. The
assistant:

- **Proposes first.** It states the pipeline it intends to create and asks for
  confirmation. Nothing is written until the user agrees.
- **Creates it whole** on agreement: the workstream with a relevant icon, an
  optional group and default owner, and an ordered pipeline of steps — each
  with an optional deadline, an optional step-level owner, and optional
  checklist sub-items.
- **Lands on screen** without a manual refresh; the user adjusts anything they
  disagree with inline, as they would with a hand-made workstream.
- **Reports the outcome faithfully on failure.** If creation breaks partway,
  the assistant states exactly what was created and what was not. The partial
  workstream stays — visible on the overview, finishable by the assistant or
  inline — and nothing is ever deleted.

Pipeline quality is part of the deliverable, not a side effect: steps are
verb-led and concrete, four to eight of them, with deadlines on the milestone
steps rather than on every step.

### Extending and correcting an existing workstream

- **Add steps**, anchored after a specific step or at the end of the pipeline.
- **Change a step**: name, deadline, owner, blocked flag; add checklist items
  to it.
- **Respect the mutability rules** without being told: past steps are frozen,
  the current step can be edited but not moved, and only the future zone
  accepts new steps.

### Deadlines

- Both phrasings work: _"six weeks before the wedding"_ and _"by 12 September"_.
- The assistant knows today's date and the project's event date and countdown,
  so relative dates resolve correctly and it can judge whether a proposed
  pipeline fits the time remaining.

### Seeing the project

- **On the project list**: the user's projects, with names and event dates.
- **On a project**: its members, its groups, its event countdown, and every
  workstream that is not yet complete — with its current step, that step's
  deadline and owner, whether it is blocked, and which group it belongs to.
  Completed workstreams are counted, not listed; the assistant can still pull
  one up by name if asked.
- **Its view stays current**, including immediately after its own writes.

### Steering the view

The assistant can change what the user is looking at: filter by owner, hide or
show groups, and bring a specific step into view — scrolled to and expanded,
the same as clicking it.

Changing the view never changes data. One caveat inherited from the overview:
an active filter disables drag-reordering, so an assistant-applied filter
briefly takes that away. The existing filter indicator makes it visible.

### Asking from the wrong page

"Add a catering workstream to the wedding project" asked from the project list
navigates there, rather than telling the user to go there first. The journey
takes two turns: authoring only exists on the overview, so after navigating the
assistant asks the user to confirm and continues on their next message.
(Automatic continuation after navigation existed on the branch and is removed
for now — it risked resuming before the new page's capabilities had
registered.)

### What the assistant cannot do

Deliberately, and stated to the user when asked:

- Start or advance a workstream
- Reorder steps
- Delete anything — workstream, step, or checklist item
- Undo anything
- Read or write notes
- Act on a project it is not currently viewing

## Decisions Made

**D1 — Additive and corrective only.** The assistant creates and edits; it
never deletes, reorders, or advances. V1 has no undo, so a wrong deletion is
unrecoverable, and reordering is the operation where an agent's model of the
pipeline is most likely to have drifted from the truth. Advancing is a
deliberate act of judgment the user should own.

**D2 — Confirmation lives in the conversation, not in a UI gate.** The
assistant states its plan and waits for agreement in chat. A dedicated
approval affordance is a better mechanism and is a candidate for later, but it
is not a prerequisite for shipping authoring.

**D3 — Partial results are reported, not rolled back.** A creation that fails
midway stays as it is; the assistant tells the user exactly which steps were
created and which were not, and can finish the job on request. Automatic
rollback would give the assistant a delete it must never otherwise have (D1),
and a visible, accurately described partial pipeline is recoverable — a
silently destroyed one is not.

**D4 — The assistant is scoped to the page.** What it can see and do is
determined by where the user is. On the overview it can author; on the project
list it can navigate and read the project list. This keeps its capabilities
legible — the user can reason about what it knows — and keeps it accurate.

**D5 — Pipeline taste is specified, not left to the model.** The assistant is
given an explicit worked example of a good pipeline. A structurally valid
"Plan / Do / Review" skeleton is a failure even though nothing rejects it.

## Out of Scope

- **Notes.** Reading or writing the note log — it is free text of unbounded
  length and its value is as a human record.
- **An approval UI.** A confirmation affordance in the panel with
  approve/reject, replacing conversational confirmation.
- **Destructive operations.** Delete, reorder, advance, undo.
- **Deep-linkable steps.** Making the expanded step part of the URL has
  standalone value and is tracked separately.
- **Bulk operations across workstreams.** "Push every catering deadline back a
  week" is a plausible next step, not this one.

## Open Questions

- Is the two-turn cross-page journey acceptable in daily use, or does
  auto-continue need to come back once its registration race is solved?
- How long does the guidance material need to be before pipeline quality is
  good? Starting short and growing on evidence.
- Does conversational confirmation prove sufficient in daily use, or does a
  real approval gate become necessary?
