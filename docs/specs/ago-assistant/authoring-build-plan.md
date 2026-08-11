# AGO Assistant: Workstream Authoring — Build Plan

How the capabilities in [PRD.md](./PRD.md) are built. Continues on
`feat/ago-sdk`, on top of the navigation and client-function work already on
that branch.

## Technical decisions

**T1 — Creation is one coarse function, not a mirror of the API.**
There is no bulk endpoint: `CreateWorkstreamDto` is
`{name, icon, groupId?, ownerId?}`, `CreateStepDto` is
`{name, position, deadline?, ownerId?}` with _"1-indexed insertion position;
must be in the future zone"_, and `CreateChecklistItemDto` is `{name}`. A
workstream with six steps and two checklists is 1 + 6 + N sequential HTTP
calls. Mirroring that as three fine-grained functions makes each call a full
model turn — roughly ten turns, 30–90 s, ten times the tokens — and puts the
position arithmetic in the model's hands. One `createWorkstream` taking a
nested `steps[]` collapses it to a single turn and makes the position invariant
a property of our code.

**T2 — Perception moves from functions to page-scoped dynamic context.**
`listProjects` and `listMembers` are **deleted**. Members are needed on nearly
every authoring turn (owner ids) and number in the handful — that is the
profile context is for, and a round-trip is for the opposite profile. Dynamic
context is re-evaluated on every send, which is also what keeps the assistant's
view current after its own writes with no "list it again" step — provided the
cache is actually fresh by then: write handlers **await** the overview refetch
before returning (see step 5) rather than invalidate-and-return, which would
race the refetch against the user's next message.

This costs one deliberate departure from the branch's fetch-at-invocation rule:
context components subscribe live to `useOverview` / `useProjectMembers`.
Acceptable because the overview page already holds both queries warm, so it is
a subscription to loaded data rather than a new request.

**T3 — Context payloads are compact lines, not JSON.**
`<workstreamId> Catering [Active] · 3/7 "Book tasting" · due 2026-09-12 ·
owner <name> · group Vendors` is roughly 40% cheaper than the equivalent JSON
and reads better to a model. Every line leads with the entity's id, and the
`project` entry carries member and group ids — T4 depends on the agent always
holding ids, so they are part of the format, not an optimization casualty. Complete workstreams are excluded and replaced by a bare count
(`12 complete (not listed)`); `getWorkstream` still reaches one by id.

**T4 — Every reference is an id, never a name.**
`expandedStep`, `getWorkstream`, and `addSteps`' anchor all take ids.
Name-matching across a 40-workstream project silently targets the wrong thing,
and a silent wrong target is worse than an error. The agent always has ids from
context.

**T5 — Deadline arithmetic is pushed into the schema.**
Context carries `today`, `eventDate` and `daysUntilEvent`. `today` must be
explicit — a model's sense of the date is anchored to training, not to now.
`deadline` accepts either `"YYYY-MM-DD"` or `{daysBeforeEvent: n}`, the second
resolved in the handler, so the natural phrasing takes the path where a
computer does the counting. A project may have **no event date**: the context
then says `no event date` explicitly rather than omitting the field,
`daysUntilEvent` is absent, and `{daysBeforeEvent}` returns a defined error
telling the model to use `"YYYY-MM-DD"` instead.

**T6 — No SDK approval gates in this chunk** (PRD D2).
`approvalPolicy` and `awaiting-approval` exist on `AgoClient`, but the prebuilt
`ChatWidget` renders no approval UI — `src/react/components/` is ChatWidget,
ChatInput, Message, Markdown, AgoNudge and nothing else. Gating therefore means
replacing the widget with a hand-built chat surface, before the assistant has
ever been seen in a browser. Conversational confirmation is driven by the guide
instead — and the requirement also lives in `createWorkstream`'s own function
description ("only call after the user has agreed to the proposed pipeline in
this conversation"): per-call instructions travel with the call and survive
guide-attention decay.

**T7 — `expandedStep` stays local `OverviewPage` state; URL params deferred.**
Deep-linkable steps have standalone value and would come free in
`pageContext="auto"`, but selection is entangled with `openNotes`, the drag
system, and `handleEntryClick`'s `requestAnimationFrame` scroll — which does
not come free from URL state, it becomes an effect watching a param. Lifting
local state gives the get/set pair today at no risk to a page with 435 tests
behind it. If the URL refactor happens later the control gets simpler, so
nothing here is wasted.

**T8 — The guide is a plain exported string constant, `stable: true`.**
No template interpolation: a date or count sneaking in would invalidate the
provider's cache silently — no error, just a quiet cost increase. Hand-written
for the agent, **not** imported from `CONTEXT.md`, which is written for
developers and changes for unrelated reasons.

**T9 — Partial failure returns an outcome report, not a rollback** (PRD D3).
`createWorkstream` and `addSteps` are sequences of HTTP calls; a failure midway
stops the sequence and returns a structured report — what was created (with
ids), what failed and why, what was never attempted — for the assistant to
relay and act on (finish with `addSteps`, adjust with `updateStep`). No
compensating deletes: the no-delete rule stays absolute, the mutation seam
needs no delete functions, and a reported partial pipeline is recoverable
where a failed rollback on top of a failed create is not.

**T10 — Auto-continue after navigation is removed** (PRD: two-turn cross-page
journey). The branch's `useAgoNavigation` auto-continue can resume the agent
before the destination page's functions and context have registered, making it
report that it cannot create. Rather than shipping authoring on top of that
race, navigation ends the turn: `navigateToPage`'s result tells the model to
say it has navigated and to continue on the user's next message. Revisit if
the two-turn journey grates and a registration-complete signal exists to gate
on.

## Function surface — 6 total

| Function           | Scope    | Shape                                                                                                                                                   |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `navigateToPage`   | app-wide | existing; auto-continue removed (T10)                                                                                                                   |
| `setPageState`     | overview | controls `ownerFilter`, `hiddenGroupIds`, `expandedStep`                                                                                                |
| `getWorkstream`    | overview | `{workstreamId}` → detail: steps with `status`, `deadline`, `ownerName`, `blocked`, `checklist[{name, done}]`, `noteCount`, plus derived `editableFrom` |
| `createWorkstream` | overview | `{name, icon, groupId?, ownerId?, steps: [{name, deadline?, ownerId?, checklist?: string[]}]}`                                                          |
| `addSteps`         | overview | `{workstreamId, after: <stepId> \| "end", steps: [...]}`                                                                                                |
| `updateStep`       | overview | `{stepId, name?, deadline?, ownerId?, blocked?, addChecklistItems?: string[]}`                                                                          |

`deadline` on every write accepts `"YYYY-MM-DD"` or `{daysBeforeEvent: number}`.

Never built: `listWorkstreams` (context covers it) and `addChecklistItems`
(folded into `updateStep`, which covers both new and existing steps).

Budget: 6 against the SDK's soft ceiling of 10 functions per message.

## Context entries — 4

| Key            | Scope        | `stable` | Contents                                                                                                                                                                      |
| -------------- | ------------ | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kosmos-guide` | app-wide     | yes      | ~400 words: domain rules, authoring taste, one worked example, explicit cannot-list                                                                                           |
| `projects`     | project list | no       | `[{id, name, eventDate}]`, soft-deleted excluded                                                                                                                              |
| `project`      | overview     | no       | `{id, name, eventDate, daysUntilEvent, today, members: [{id, name, isOwner}], groups: [{id, name}]}`; the signed-in member's line is marked `(you)` so "me" resolves to an id |
| `workstreams`  | overview     | no       | non-complete workstreams, one line each, plus a count of completed                                                                                                            |

`groups` sits in the `project` entry for the same reason members do:
`createWorkstream` takes a `groupId` and cannot fill it otherwise.
`pageContext="auto"` stays on.

## Steps

**1 — Imperative mutation seam in the API layer.**
Handlers cannot call hooks, and every mutation is currently a `useMutation`
wrapper. Add imperative functions next to them, mirroring the existing
`fetchProjects` / `fetchProjectMembers` seam, with the hooks and the assistant
sharing one implementation: `createWorkstream`, `createStep`,
`createChecklistItem`, `updateStep`, plus
`fetchOverview(queryClient, projectId)` in `use-overview.ts` — no delete
functions (T9). Assistant writes refresh the overview through `queryClient`
with an awaited refetch (T2) rather than the `useInvalidateOverview` hook.
_Verify:_ existing mutation hooks behave identically; the overview cache seam
is untouched.

**2 — Context layer** (`src/assistant/context/`).
Builders as pure functions — `build-projects-context.ts`,
`build-project-context.ts`, `build-workstreams-context.ts` — each taking
already-fetched data and returning a `ContextEntry`. Mount components live
inside their owning pages behind `AssistantScope`, like
`OverviewAssistantFunctions` today — they subscribe to the page's warm queries
and take `projectId` from it: `project-list-assistant-context.tsx` and
`overview-assistant-context.tsx`, using `useAgoContext(provider, key)` with the
dynamic-provider overload.
_Verify:_ `getContextSnapshot()` in the browser console shows the expected
entries and nothing more; the line format renders as intended.

**3 — Delete `listProjects` and `listMembers`; remove auto-continue.**
Both function modules and their bindings. `GlobalAssistantFunctions` is left
with nothing to register — delete the file; `AssistantNavigation` continues to
own `navigateToPage`. In the same pass, remove auto-continue from the
navigation flow (T10) and reword `navigateToPage`'s result so the model tells
the user it has navigated and ends its turn.

**4 — `getWorkstream`** (`src/assistant/functions/get-workstream.ts`).
Reads via `fetchOverview` cache-first, projects to the curated shape, derives
`editableFrom` from the pointer. No note bodies — unbounded free text is the
fastest route to the 50 KB result cap; `noteCount` only.

**5 — `createWorkstream`** — the load-bearing piece.
Orchestrates workstream → steps (contiguous 1-indexed positions) → checklist
items; resolves `{daysBeforeEvent}` against the project's `eventDate`, with
the defined no-event-date error (T5). A failure midway stops the sequence and
returns the outcome report (T9); success returns the new ids. Both paths
`await` the overview refetch before returning (T2), so the partial or complete
result is on screen and in context for the next turn. Its function description
carries the confirmation requirement (T6).

**6 — `addSteps` and `updateStep`.**
`addSteps` resolves its `after: stepId | "end"` anchor to a position in the
handler — the agent never emits an integer. Both re-check the future-zone rule
against fresh data before writing, return the same outcome report on partial
failure (T9), and await the overview refetch before returning (T2).

**7 — Page state** (`overview-assistant-page-state.tsx`).
`useAgoPageState` with the three controls. `OverviewPage` must expose
`setHiddenGroupIds` (the control sets a list, it does not toggle) alongside the
existing `handleGroupToggle`, and `expandedStep`'s setter reuses
`handleEntryClick` wholesale so agent-driven selection scrolls into view —
selection the user cannot see is worse than none. Its description closes the
trap explicitly: _"Setting it only changes what the user sees — use
`updateStep` to change data."_

**8 — `kosmos-guide.ts`.**
~400 words, the bulk of it one worked example: a realistic pipeline with
verb-led step names, deadlines on the milestone steps only, and one checklist
step. Then the mechanical rules (lifecycle, `editableFrom`, calendar-day
deadlines, owner inheritance, checklists gate nothing), the cannot-list, the
instruction to propose and confirm before writing, and a note that `icon` is
required so it must pick a relevant emoji. Start lean; grow only on evidence of
invalid or bland pipelines.

**9 — Tests.**
Unit, against the render-free handler factories: position computation, the
outcome report on partial failure (created/failed/not-attempted all accurate),
`{daysBeforeEvent}` resolution including the no-event-date error,
`editableFrom` derivation, payload projection. Plus **one** integration test that the overview's functions
and context register on arrival and unregister on leave —
conditional-mounting-as-registration is the design's central bet and nothing
else catches it breaking.

**10 — Browser pass.**
Nothing on this branch has been seen in a browser yet. Exercise authoring end
to end; the two-turn cross-page journey (ask from the project list →
`navigateToPage` → user confirms on the overview → creates); and panel width
against the overview's widget rail.

## Risks

- **`editableFrom` derivation.** Wrong, and the agent confidently proposes
  edits to frozen steps. Unit-tested across all three lifecycle states.
- **Two-turn navigation friction.** Without auto-continue (T10) the wrong-page
  journey needs a user nudge after navigating. If that grates in practice,
  auto-continue returns only with a registration-complete signal to gate on.
- **Outcome-report accuracy.** With no rollback (T9), the report is the only
  thing standing between a partial failure and a confused user — it must never
  claim more or less than what was written. Unit-tested in step 9.
- **`icon` is required** on `CreateWorkstreamDto`. Omitted, creation fails
  outright; the guide must say so.
- **Context growth.** Roughly 1k tokens per message on a 40-workstream project,
  on every send. The completed-count exclusion is the main lever.
- **Silent cache invalidation** if anything dynamic reaches the `stable: true`
  guide.

## Module layout

```
src/assistant/
  functions/      get-workstream.ts, create-workstream.ts, add-steps.ts, update-step.ts
  context/        build-*-context.ts, kosmos-guide.ts
  *.tsx           mount components (provider, navigation, panel, scope,
                  overview-assistant-{functions,context,page-state})
```

## SDK facts worth recording

- `useAgoPageState` deps are `[client, fnName, requiresApproval]` — controls
  may be built inline each render. This differs from `useAgoFunction`, where
  `parameters` is a dep by identity and the static shape must be hoisted to
  module scope.
- `useAgoContext` has a dynamic-provider overload, ref-backed, so a provider
  closing over live query data does not churn.
- `ChatWidget` renders no approval UI; `approvalPolicy` is client-only.
- Function results are capped at 50 KB by default (`maxResultBytes` per
  function); degradation is expected past ~10 functions per message, hard limit 30.
