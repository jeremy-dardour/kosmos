# Overview rework — implementation plan (#40)

Status: ready-for-agent

The ordered build plan for
[#40 — UI rework: inline overview editing](https://github.com/jeremy-dardour/wedding-planner/issues/40).
Every design decision is already made — **do not reopen any of them**. This
plan tells you what to build, in what order, and how to verify each phase.

## What you must read first

| Doc                                                                                    | What it gives you                                                                                                       |
| -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| [Handoff](../../prototype/overview-editing/HANDOFF.md)                                 | Every decision + the complete behaviour spec (appendix A1–A16). The behaviours you build are specified there, not here. |
| [V1 API contract](./api-contract.md)                                                   | The exact endpoints, DTOs, error slugs and cache rules.                                                                 |
| [V1 Product PRD](./PRD.md) § "The overview"                                            | Product-level behaviour and rationale.                                                                                  |
| `apps/web/src/features/overview/overview-editing-prototype.tsx` (branch `prototype-2`) | Working reference for look & interaction. It is throwaway code — copy behaviour, not structure.                         |
| [CONTEXT.md](../../../CONTEXT.md)                                                      | Domain rules (pipeline mutability, insertion zone, ownership inheritance).                                              |

Ground rules that bite in this codebase:

- **Read ports from [PORTS.md](../../../PORTS.md)** — never assume defaults.
- **Keep `OverviewPage` router-free** — the test harness renders it without a
  Router; `useSearchParams` there once broke 46 tests.
- **No Playwright** — integration coverage is Testing Library + MSW.
- After any API route/DTO change: `pnpm generate:api-types` and commit the
  regenerated `packages/api-contracts/src/openapi.d.ts`.
- After entity changes: create + review a migration, verify zero schema diff.
- Gate for every phase: `pnpm check-types && pnpm lint && pnpm test`, plus
  `pnpm --filter api test:e2e` for any API phase.

---

## Phase A — Backend (contract first)

Work from the [V1 API contract](./api-contract.md); it is the single source
for shapes and error slugs. Suggested PR split: A1+A2 (read model + positions),
A3 (reordering), A4+A5 (granular step/checklist editing).

### A1. `noteCount` on the overview aggregate

- Add `noteCount` to `StepDto`; compute it in the overview aggregate query
  (`apps/api/src/modules/project/repositories/overview.repository.ts`) — a
  grouped count join, **not** N queries and **not** loading note bodies.
- Every endpoint that returns `StepDto`/`WorkstreamDto` must include it
  (mutation responses too — the web patches them into the cache).
- E2E: count present per step; note create/delete changes it.

### A2. `position` columns + create-at-top

- Entities: `position: number` on `Workstream` (scope: its group, ungrouped =
  own scope) and on `Group` (scope: project). Follow
  [ENTITIES_STANDARDS.md](../../../apps/api/ENTITIES_STANDARDS.md); unique
  `(scope, position)` constraints match the existing Step pattern.
- Migration seeds positions from current alphabetical order per scope.
- Overview + group queries order by `position` (replaces `name asc`).
- `POST /projects/:id/workstreams` inserts at position 0 of its scope,
  shifting siblings in the same transaction. `PATCH /workstreams/:id` with a
  `groupId` change moves the row to the **top** of the target scope and
  renumbers both scopes.
- `GroupDto`/`WorkstreamDto` gain `position`.

### A3. Reorder endpoints

- `PUT /projects/:projectId/group-order` and
  `PUT /projects/:projectId/workstream-order` per the contract. Validate ids
  = exact current scope membership → 409 `order-mismatch`; rewrite contiguous
  positions with the two-phase temporary-position pattern (constraints are
  not deferrable — see the existing checklist/step reorder repositories).
- E2E: reorder, order-mismatch rejection, cross-scope ids rejected.

### A4. Granular step endpoints (replaces the whole-tail PUT)

- New: `POST /workstreams/:id/steps`, `PATCH /steps/:id`,
  `DELETE /steps/:id`, `PUT /workstreams/:id/step-order` — bodies, responses
  and error slugs exactly as the contract (422 empty name, 409
  `step-insertion-illegal`, `step-frozen`, `step-not-deletable`,
  `order-mismatch`).
- Port the mutability guards out of `validatePipelineEdit` into per-operation
  checks; each operation is one transaction.
- **Remove** `PUT /workstreams/:id/pipeline`, `UpdatePipelineDto`,
  `EditableStepDto`, `EditableChecklistItemDto`, `replacePipeline` and their
  tests. No `expectedUpdatedAt` anywhere — last-write-wins on fields is the
  decided model, don't "improve" it back in.

### A5. Checklist item endpoints

- `POST /steps/:stepId/checklist-items`, extend `PATCH /checklist-items/:id`
  with optional `name` (empty rejected), `DELETE /checklist-items/:id`.
  All 409 `step-frozen` on past steps.

### A6. Throttle raise

- Authenticated throttle 30/min → 120/min in
  `apps/api/src/app/config/security.config.ts` (commit-on-blur bursts were
  measured tripping 30/min).

### A7. Contract regeneration

- `pnpm generate:api-types`; commit. Then align the api-contract doc if
  anything drifted (OpenAPI wins).

---

## Phase B — Web foundation

### B1. Urgency tokens + five bands

- Add orange and yellow urgency tokens (light **and** dark) to
  `apps/web/src/main.css`; extend `urgency.ts` from three bands to five
  (`passed` / `week` / `fortnight` / `month` / `far`, handoff A6). No
  Tailwind default colours in production.

### B2. Countdown/date fixes (the two live bugs)

- "in 0d" → `today` / `tomorrow` wording, all three locales
  (`overview.badge.*`).
- Date formatting keeps the year when not current (`1 Oct 25`) — handoff §7.

### B3. API hooks + cache layer

- One mutation hook per endpoint in `src/api/hooks/`, re-exporting type
  aliases (feature code never imports `@/types/openapi`).
- **Cache seam** (this is the heart of the save model — build it once,
  deliberately):
  - `patchOverviewCache` — applies a mutation response (`StepDto` or
    `WorkstreamDto`) into the cached `OverviewDto` via `setQueryData`.
  - `useTrailingOverviewInvalidate` — one invalidate ~2s after the last
    mutation settles, **deferred while any inline editor input has focus**
    (run on blur). No per-mutation invalidation.
  - Note mutations patch `noteCount` and invalidate the notes query.
- Client-side derivation of the nearest-deadline badge from cached steps (a
  step-field patch does not refresh `nearestDeadlineStepId`; derive it or
  accept trailing-invalidate reconciliation — pick one and note it in code).

---

## Phase C — Web components

Decompose through production modules — the prototype's single file is not a
model. Boundaries (all in `src/features/overview/`):

| New module                                                                                        | Owns (handoff ref)                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `overview-list.tsx`                                                                               | Layout, live/completed partition, `max-w-[110rem]` (A1)                                                                                                                            |
| `sortable-group-section.tsx`                                                                      | Group section + per-group card DnD context (A14)                                                                                                                                   |
| `completed-section.tsx`                                                                           | Collapsed section + per-group clusters (A15)                                                                                                                                       |
| `workstream-card.tsx` (rewrite)                                                                   | Chrome by lifecycle, header live fields (A2)                                                                                                                                       |
| `advance-control.tsx`                                                                             | Split button / Resolve / Start (A16) — keep the command semantics, pending state and Problem Details surfacing of today's `workstream-card-action.tsx`; its spec must keep passing |
| `pipeline-row.tsx`                                                                                | Dots, titles, urgency rings/dates, note markers, owner-override avatars, insert points (A3–A5, A8)                                                                                 |
| `step-editor.tsx`                                                                                 | The strip: fields, checklist, notes, footer (A9)                                                                                                                                   |
| `step-notes-panel.tsx` + shared `note-thread.tsx`                                                 | A10, A11                                                                                                                                                                           |
| `dot-caret.tsx`, `drag-handle.tsx`, `click-to-edit.tsx`, `owner-picker.tsx`, `deadline-field.tsx` | Shared primitives                                                                                                                                                                  |

DnD implementation notes (all learned the hard way — handoff §9): dnd-kit
with `CSS.Translate` only; one nested `DndContext` per group; vertical-axis
modifier; 4px distance-gated pointer sensor; keyboard sensor; no handle for a
lone card in its group; dragging disabled while any filter is active.

Editing behaviours: commit on blur/Enter, Escape cancels; ghost step until
first non-empty name commit (notes/checklist disabled on ghosts, 409 discards
with a message); click-away closes editors but portalled pickers count as
inside; one open editor across the list.

Delete when absorbed (handoff §10): `detail-panel`, `vertical-pipeline`,
`pipeline-editor`, `step-checklist`, `checklist-card`, `step-notes`,
`workstream-card-list`, `group-section`, `pipeline-dots`, `deadline-badge`,
the old `workstream-card` internals, **the prototype file and the
`?variant=A` seam**, and the lifecycle sort in `group-workstreams.ts`.

---

## Phase D — Copy, errors, a11y, mobile

- **i18n**: every string in all three locales (`en`, `fr`, `es`); flat keys
  `page.component.subComponent`. No hardcoded English.
- **Errors**: Problem Details surfaced per operation; a failed commit never
  silently discards input (restore the field with the user's value).
- **Tooltips**: every icon-only button (add-step `+`, drag handles, note
  markers, icon picker, advance cluster) carries at least a native `title`
  mirroring its accessible name.
- **A11y**: keyboard reachability of hover `+`, markers, dots, handles;
  focus management on editor open/close.
- **Mobile**: verify common breakpoints, no horizontal overflow (ghost
  checklists and wide dot columns are the known risks).

---

## Phase E — Tests

Integration (Testing Library + MSW, real providers) per the ticket:

- past/current/future mutability, incl. frozen steps accepting notes;
- insertion legality across NotStarted / Active / Complete;
- five urgency bands incl. the year-boundary case;
- note authorship rules;
- the save model: blur commits, response patching, trailing invalidate
  deferred while focused, ghost-step create/reject/discard, 409 surfacing;
- manual ordering: within-group reorder, group reorder, order-mismatch
  recovery, no-handle-for-lone-card, drag disabled under filters;
- completed section: partition, collapse/expand, completion moves the card.

Rewrite the specs listed in handoff §10; extend the stateful MSW adapter for
the new endpoints. `workstream-card-action.spec`'s scenarios must survive
(possibly relocated to `advance-control.spec`) — if they break, the primary
action broke.

---

## Done when

Mirror of #40's checklist, updated for the settled decisions:

- [ ] Phase A endpoints live, whole-tail PUT removed, types regenerated.
- [ ] Ordering persisted; migration seeds alphabetical order.
- [ ] All handoff appendix behaviours (A1–A16) implemented through the Phase C
      modules.
- [ ] Prototype file + `?variant=A` seam deleted.
- [ ] Urgency tokens exist for light and dark.
- [ ] i18n complete; tooltips on all icon-only buttons.
- [ ] Problem Details, focus-safe refetch, no silent input loss.
- [ ] A11y + mobile verified.
- [ ] The two production date bugs fixed.
- [ ] All gates green: `pnpm check-types && pnpm lint && pnpm test` and
      `pnpm --filter api test:e2e`.
