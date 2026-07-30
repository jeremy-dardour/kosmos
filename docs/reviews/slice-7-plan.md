# Slice 7 — Workstream + Group Management (Plan)

_Ticket: [#24](https://github.com/jeremy-dardour/wedding-planner/issues/24). Branch: `feat/slice-7`. Frontend only._

## Decisions taken

- **Form presentation:** shadcn `Dialog` modals (reuse `dialog.tsx`).
- **Create/edit modal fields:** name + icon + optional group + optional owner
  (full set per PRD). Icon required (API needs it); group/owner optional.
- **Edit surface:** simplest route now — reuse the create modal, opened from the
  detail panel. Polished edit UX deferred to a follow-up ticket.
- **Groups:** a "Manage Groups" modal (list + inline edit/delete + add row).
- **Project settings:** its own small modal (name + event date).

## Backend

Done already — no API changes. All seven endpoints and DTOs exist
(`POST/PATCH/DELETE /workstreams`, `POST/PATCH/DELETE /groups`,
`PATCH /projects/:id`). No migrations, no e2e, no `generate:api-types`. Confirm
the paths are already in the committed `openapi.d.ts` before wiring hooks.

## Design shape (deep modules at clean seams)

Everything hangs off the **overview aggregate**, so every mutation's only job is
to fire and invalidate the overview — the seam each hook hides.

### 1. Mutation hooks (`apps/web/src/api/hooks/`)

Thin, deep wrappers, one per operation, each following the existing
`invalidateOverview` pattern from `use-update-pipeline.ts`, each re-exporting its
input type alias (per web standard):

- `use-create-workstream.ts`, `use-update-workstream.ts`, `use-delete-workstream.ts`
- `use-create-group.ts`, `use-update-group.ts`, `use-delete-group.ts`
- `use-update-project.ts`

Caller interface is just `mutation.mutate({ params, body })`; which query keys
change is hidden. Groups/project/workstreams all live in the overview response,
so all invalidate the same key.

### 2. `WorkstreamFormDialog` (`features/overview/`)

One deep component, create **and** edit modes behind a small interface
(`mode`/`workstream?`, `groups`, `users`, `onClose`). Fields: name (input), icon
(emoji text input), group (`<select>` of groups + "None"), owner (`<select>` of
users + "Unassigned") — reusing the native-`<select>` idiom from
`pipeline-editor.tsx`. Validation: name non-empty ≤255, icon non-empty.
Dispatches to create vs update internally — one real thing varies (create/edit),
so one component with a mode branch, not two.

### 3. `GroupManagerDialog`

Lists groups with inline name + color (`<input type="color">`) edit, per-row
delete-with-confirm, and an add-group row. Hides all three group mutations +
row-local draft state behind `{ groups, projectId, onClose }`.

### 4. `ProjectSettingsDialog`

Name (input) + event date (`<input type="date">`, nullable → clear). Wraps
`use-update-project`.

### 5. `ConfirmDialog` (tiny, shared)

In `components/ui/` or `features/overview/`, reused by workstream-delete and
group-delete so confirmation copy/behavior lives in one place.

## Entry points & state

- **State lifted to `OverviewPage`:**
  `workstreamForm: {mode:'create'} | {mode:'edit', workstream} | null`,
  `groupManagerOpen`, `projectSettingsOpen`, `deleteWorkstream: Workstream | null`.
  Delete → on success the existing selection null-guard (`overview-page.tsx:75`)
  auto-closes the panel once the card leaves the data.
- **`OverviewHeader`:** add "+ New Workstream", a "Manage groups" trigger, and a
  project-settings affordance (gear next to the title). New props:
  `onNewWorkstream`, `onManageGroups`, `onProjectSettings`.
- **`DetailPanel` header:** add a `…` menu (`dropdown-menu.tsx`) with **Edit
  details** (opens the form modal pre-filled) and **Delete**. Leave the existing
  pipeline **Edit** button as-is. New props: `onEdit`, `onDelete`.
  (Deliberately unpolished — covered by the follow-up ticket.)

## i18n

New flat keys in `en/fr/es.json` under `overview.manage.*` (labels,
placeholders, confirm copy, field labels).

## Tests

Integration only, in `overview-integration.spec.tsx` via `renderWithApp` + MSW,
matching the ticket's 7 scenarios (create, create-with-group, edit, delete,
create-group, delete-group→ungrouped, edit project). Extend the existing stateful
MSW adapter in `mock-api.ts` rather than hand-rolling handlers, with RFC 9457-shaped
errors. No Playwright (deferred per standard).

## Follow-up ticket

File a frontend ticket — **"Polish workstream create/edit + group/project
management UX"** (or fold into #39) — capturing the deferred edit-surface niceties
(inline panel editing, emoji picker, group create-inline from the workstream
dropdown, dialog density/a11y).

## Verify before done

`pnpm check-types && pnpm lint && pnpm test`; confirm the openapi paths are
present (no regen expected).

## Scope estimate

~12 new files (7 hooks + 4 dialogs + confirm) plus edits to `overview-page`,
`overview-header`, `detail-panel`, locales, and the test/mock files.

---

## Precise implementation

### Confirmed facts

- All 5 openapi paths + 7 DTO schemas exist in `openapi.d.ts`; no regen.
- Header renders `overview.data.project` (not `useProjects`), so project edits
  invalidate the overview. `useProjects` only discovers the id — but its list
  cache also holds name/date, so `use-update-project` invalidates both.
- Detail panel already has an "Edit pipeline" button (`overview.editor.edit`);
  add a separate `…` menu for details/delete, leaving pipeline editing intact.
- Overview selection auto-clears when a workstream leaves the data
  (`overview-page.tsx:75`), so delete needs no explicit panel close.
- `fr.json`/`es.json` carry real translations → translate all new keys.
- MSW lifecycle handled globally in `testing/setup.ts`.

### New hooks (`apps/web/src/api/hooks/`)

- `use-invalidate-overview.ts` — shared `useInvalidateOverview(projectId)`
  returning a memoized callback that hides the overview query-key seam. Refactor
  `use-advance-workstream` and `use-update-pipeline` onto it too (locality).
- `use-create-workstream.ts` (`post /projects/{projectId}/workstreams`)
- `use-update-workstream.ts` (`patch /workstreams/{id}`)
- `use-delete-workstream.ts` (`delete /workstreams/{id}`)
- `use-create-group.ts` / `use-update-group.ts` / `use-delete-group.ts`
- `use-update-project.ts` (`patch /projects/{id}`; invalidates overview + list)

Each re-exports its input type alias (`CreateWorkstreamInput`, …).

### New components (`features/overview/`)

- `workstream-form-dialog.tsx` — props `{ mode, workstream?, projectId, groups,
users, open, onOpenChange }`. Fresh state per open via a parent `key`. Fields
  name/icon (`Input`), group/owner (native `<select>` idiom). Valid when
  name+icon non-empty. Dispatches create vs update; closes on success.
- `group-manager-dialog.tsx` — props `{ projectId, groups, open, onOpenChange }`.
  Per-row name `Input` + `<input type="color">` + Save (PATCH) + Delete
  (confirm); an add-group row (POST).
- `project-settings-dialog.tsx` — props `{ project, open, onOpenChange }`. Name
  - `<input type="date">` (empty → null). PATCH project.
- `confirm-dialog.tsx` — props `{ open, onOpenChange, title, description,
confirmLabel, onConfirm, isPending }`. Reused by workstream + group delete.

### Edits

- `overview-header.tsx` — add `onNewWorkstream`, `onManageGroups`,
  `onProjectSettings`; gear by the title + "New Workstream"/"Manage groups"
  triggers in the actions row.
- `detail-panel.tsx` — add `onEdit`, `onDelete`; a `…` `DropdownMenu`
  (Edit details / Delete-destructive).
- `overview-page.tsx` — owns `workstreamForm | null`, `groupManagerOpen`,
  `projectSettingsOpen`, `deleteWorkstream | null`; renders the four dialogs;
  wires `useDeleteWorkstream`.
- `i18n/locales/{en,fr,es}.json` — new `overview.manage.*` keys (en + real
  fr/es).

### Tests

New `overview-management.integration.spec.tsx` (stateful-adapter naming
convention), driven by an extended `setupOverviewApi` in `mock-api.ts` with
create/update/delete handlers for workstream, group, and project that mutate the
in-memory `overview`. Covers the ticket's 7 scenarios. (Deviates from the
ticket's "in overview-integration.spec.tsx" to honor the web standard's
focused-adapter rule and the existing `*.integration.spec.tsx` convention.)

### Deferred → follow-up ticket (#43)

Emoji picker, inline-in-panel edit, group create-inline from the workstream
dropdown, dialog density/a11y polish. Filed as
[#43](https://github.com/jeremy-dardour/wedding-planner/issues/43).
