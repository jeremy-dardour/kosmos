# Overview rework — implementation plan (#40)

Status: ready-for-agent

The ordered build plan for
[#40 — UI rework: inline overview editing](https://github.com/jeremy-dardour/kosmos/issues/40).
Every design decision is already made — **do not reopen any of them**. This
plan tells you what to build, in what order, commit by commit.

## The reading contract

This plan contains **no behaviour**. Three docs divide the work between them —
you need all three:

| Doc                                                    | Role                                                                                                                                                            | How to read                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **This plan**                                          | The order of work: commits, tests, gates                                                                                                                        | Follow top to bottom               |
| [Handoff](../../prototype/overview-editing/HANDOFF.md) | **The normative behaviour spec** — appendix A1–A16 defines what every surface does; §9 gotchas and §10 component map are required; §1–§5 are background to skim | Keep open while building Phase C/D |
| [V1 API contract](./api-contract.md)                   | Exact endpoints, DTOs, error slugs, cache rules                                                                                                                 | Keep open while building Phase A/B |

Secondary references: [V1 Product PRD](./PRD.md) § "The overview" (product
rationale), [CONTEXT.md](../../../CONTEXT.md) (domain rules), and the
prototype `apps/web/src/features/overview/overview-editing-prototype.tsx` on
`prototype-2` — a working reference for look and interaction. It is throwaway
code: copy behaviour, never structure.

## Shape of the work

- **One PR.** Branch from `prototype-2` (it carries these docs and the
  prototype); target `main`. Keep the commit sequence below — every commit
  must leave the tree green.
- **Green per commit**: `pnpm check-types && pnpm lint && pnpm test`; commits
  touching the API also run `pnpm --filter api test:e2e`.
- **Tests land with the commit** that adds the behaviour — never in a
  catch-up commit at the end.
- Every API-route/DTO commit ends with `pnpm generate:api-types` and includes
  the regenerated `packages/api-contracts/src/openapi.d.ts`.
- Entity changes: create + review a migration; verify zero schema diff.

Ground rules that bite in this codebase:

- **Read ports from [PORTS.md](../../../PORTS.md)** — never assume defaults.
- **Keep `OverviewPage` router-free** — the test harness renders it without a
  Router; `useSearchParams` there once broke 46 tests.
- **No Playwright** — integration coverage is Testing Library + MSW.
- **Do not remove the whole-tail `PUT /pipeline` in Phase A.** The old
  pipeline editor still calls it; it dies in C18 when its last caller does.
- i18n as you go: every string added in a component commit lands in `en`,
  `fr`, `es` in that same commit.

---

## Phase A — Backend (commits C1–C7)

Work from the [V1 API contract](./api-contract.md). Each commit: service/repo
change + unit tests + e2e coverage + regenerated types.

**C1 — `noteCount` on the overview aggregate.**
`StepDto.noteCount`; computed in
`apps/api/src/modules/project/repositories/overview.repository.ts` as a
grouped count join (not N queries, no note bodies). Include it in every
endpoint returning `StepDto`/`WorkstreamDto`. Tests: aggregate carries counts;
note create/delete changes them (e2e).

**C2 — `position` columns + create-at-top.**
`position` on `Workstream` (scope: its group; ungrouped = own scope) and
`Group` (scope: project) per
[ENTITIES_STANDARDS.md](../../../apps/api/ENTITIES_STANDARDS.md); unique
`(scope, position)` like the Step pattern. One migration seeds positions from
current alphabetical order. Queries order by `position`. `POST workstreams`
inserts at position 0 shifting siblings; `PATCH` with a `groupId` change moves
to the top of the target scope, renumbering both scopes, in one transaction.
DTOs gain `position`. Tests: seed order, create-at-top, group-move renumber
(e2e).

**C3 — Reorder endpoints.**
`PUT /projects/:id/group-order`, `PUT /projects/:id/workstream-order`. Ids
must equal exact scope membership → 409 `order-mismatch`; single-phase
renumber in one locked transaction — the position constraints are generated
`deferrable initially deferred`, matching the existing step/checklist reorder
idiom. Tests: happy reorder both levels, mismatch, ids from another scope
(e2e).

**C4 — Granular step field/create/delete.**
`POST /workstreams/:id/steps` (insert at `position`, future zone only, 409
`step-insertion-illegal`), `PATCH /steps/:id` (422 empty name; 409
`step-frozen` on past; `blocked` only meaningful on current), `DELETE
/steps/:id` (future only, 409 `step-not-deletable` on current, `step-frozen`
on past; siblings renumber). Port guards out of `validatePipelineEdit` into
per-operation checks — do not delete `replacePipeline` yet. Tests: every
guard, per endpoint (unit + e2e).

**C5 — Step reorder.**
`PUT /workstreams/:id/step-order`: complete future tail, exactly once each →
409 `order-mismatch`; single-phase renumber under the deferred unique
constraint (see C3). Tests: reorder, partial list, stale list after an
advance (e2e).

**C6 — Checklist item endpoints.**
`POST /steps/:stepId/checklist-items`, `PATCH /checklist-items/:id` gains
optional `name` (422 empty), `DELETE /checklist-items/:id`; all 409
`step-frozen` on past steps. Tests per operation (e2e).

**C7 — Throttle raise.**
Authenticated 30/min → 120/min in
`apps/api/src/app/config/security.config.ts` (commit-on-blur bursts measured
tripping 30/min).

---

## Phase B — Web foundation (C8–C10)

**C8 — Urgency tokens + five bands.**
Orange + yellow tokens, light **and** dark, in `apps/web/src/main.css`;
`urgency.ts` goes three → five bands (handoff A6). No Tailwind default
colours. Tests: band boundaries in `urgency.spec`, incl. the year-boundary
case.

**C9 — Countdown/date fixes (the two live bugs).**
"in 0d" → `today`/`tomorrow` in all three locales (`overview.badge.*`); date
formatting keeps the year when not current (`1 Oct 25`). Tests: both cases.

**C10 — Hooks + the cache seam.**
One mutation hook per new endpoint in `src/api/hooks/` (type aliases
re-exported; feature code never imports `@/types/openapi`). The save-model
core, built once, deliberately:

- `patchOverviewCache` — applies a `StepDto` or `WorkstreamDto` mutation
  response into the cached `OverviewDto` via `setQueryData`.
- `useTrailingOverviewInvalidate` — one invalidate ~2s after the last
  mutation settles, **deferred while any inline editor input has focus** (runs
  on blur). No per-mutation invalidation.
- Note mutations patch `noteCount` and invalidate the notes query.
- Decide in code (comment it): derive the nearest-deadline badge client-side
  from cached steps, or accept trailing-invalidate reconciliation.

Extend the stateful MSW adapter (`mock-api.ts`) with the new endpoints in this
commit. Tests: patch merge cases, focus deferral, count patching (unit).

---

## Phase C — Components (C11–C17)

One module (or tight cluster) + its spec per commit, all in
`src/features/overview/`. Behaviour comes from the handoff appendix — the
(A-refs) below are the spec for that commit. i18n in the same commit.

**C11 — Primitives.**
`drag-handle.tsx`, `click-to-edit.tsx`, `owner-picker.tsx`,
`deadline-field.tsx`, `dot-caret.tsx`. Unit specs where there's branching
(commit/cancel semantics of click-to-edit at minimum).

**C12 — `pipeline-row.tsx`** (A3, A4, A5, A7, A8).
Dots, 13px titles, urgency rings + dates, note markers, owner-override
avatars, checklist previews, insert points. Gotchas: `pointer-events-none`
connectors; zero-width insert points; caret column mirroring. Spec: statuses,
rings by band, marker/override visibility, insertion legality rendering.

**C13 — `advance-control.tsx`** (A16).
Port the semantics, row-local pending state and Problem Details surfacing of
`workstream-card-action.tsx`. Migrate `workstream-card-action.spec` scenarios
to `advance-control.spec` — every scenario must survive; if one breaks, the
primary action broke.

**C14 — `workstream-card.tsx` rewrite** (A2, A12).
Chrome by lifecycle (light half-frame when complete), header live fields
committing on blur/selection via C10 hooks, click-away rules (portalled
pickers count as inside). Integration spec: header edits round-trip, chrome
states.

**C15 — `step-editor.tsx` + `step-notes-panel.tsx` + `note-thread.tsx`**
(A9, A10, A11). Frozen-step read-only rules, checklist block, note authorship
rules, footer controls. Integration spec: past/current/future mutability incl.
frozen steps accepting notes; note authorship (only own entries editable,
past threads append-only).

**C16 — Ordering + completed section** (A1, A14, A15).
`overview-list.tsx`, `sortable-group-section.tsx`, `completed-section.tsx`.
dnd-kit: `CSS.Translate` only; one nested `DndContext` per group;
vertical-axis modifier; 4px distance gate; keyboard sensor; no handle for a
lone card; **dragging disabled while any filter is active**. Integration
spec: within-group reorder persists via the reorder endpoint, group reorder,
order-mismatch recovery (refetch + retry path), completed partition +
collapse/expand + completion moves the card.

**C17 — Page swap + ghost steps** (A8, A12, A13→§6.2).
Wire the new list into `overview-page.tsx` replacing the old card list
(router-free). Ghost-step flow: insert point → local ghost, `POST` on first
non-empty name commit, empty/Escape discards, 409 `step-insertion-illegal`
discards with a message, notes/checklist disabled on ghosts. Integration
spec: the save-model journeys — blur commits, response patched without
refetch, trailing invalidate deferred while focused, ghost create/reject/
discard, a 422/409 never silently discards input.

---

## Phase D — Cleanup + hardening (C18–C20)

**C18 — Delete the superseded surface.**
In one commit, because they die together: the old components (handoff §10:
`detail-panel`, `vertical-pipeline`, `pipeline-editor`, `step-checklist`,
`checklist-card`, `step-notes`, `workstream-card-list`, `group-section`,
`pipeline-dots`, `deadline-badge`, `workstream-card-action` — its spec now
lives on as `advance-control.spec`), their specs, the lifecycle sort in
`group-workstreams.ts`, the prototype file, the `?variant=A` seam, **and the
API's whole-tail editing**: `PUT /workstreams/:id/pipeline`,
`UpdatePipelineDto`, `EditableStepDto`, `EditableChecklistItemDto`,
`replacePipeline` + tests, and the `useUpdateWorkstreamPipeline` hook. No
`expectedUpdatedAt` anywhere afterwards — last-write-wins is the decided
model; don't "improve" it back in. Regenerate types. Full gates + e2e.

**C19 — A11y + tooltips pass.**
Keyboard reachability of hover `+`, markers, dots, handles; focus management
on editor open/close; every icon-only button carries at least a native
`title` mirroring its accessible name. Spec additions for keyboard paths.

**C20 — Mobile pass.**
Common breakpoints, no horizontal overflow (ghost checklists and wide dot
columns are the known risks). Fix what's found; note deliberate deferrals in
the PR description.

---

## Done when

- [ ] C1–C20 landed in order, each green at commit time.
- [ ] All handoff appendix behaviours (A1–A16) implemented through the Phase C
      modules.
- [ ] Whole-tail PUT, old components, prototype and `?variant=A` all gone.
- [ ] Advance scenarios survive in `advance-control.spec`.
- [ ] Urgency tokens exist for light and dark; i18n complete in three locales;
      tooltips on all icon-only buttons.
- [ ] Problem Details surfaced; focus-safe refetch; no silent input loss.
- [ ] The two production date bugs fixed.
- [ ] Final gates: `pnpm check-types && pnpm lint && pnpm test` and
      `pnpm --filter api test:e2e`.
