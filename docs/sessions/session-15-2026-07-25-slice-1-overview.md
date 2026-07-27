# Session 15 — Slice 1 / PR #31 (2026-07-25–27)

Built and reviewed [#18](https://github.com/jeremy-dardour/wedding-planner/issues/18)
end to end: the overview aggregate API and first real-data Pipeline Stack UI.

## Delivered

- Consolidated Project, Group, Workstream, Step, ChecklistItem, and Note into
  one `project` NestJS module; retained User as a separate entity concern.
- Added project/group/workstream CRUD and
  `GET /projects/:projectId/overview`, with same-project guards, validation,
  cascade behavior, and one repeatable-read snapshot for the overview.
- Built the two-panel overview UI with grouped cards, lifecycle/status dots,
  owners, deadline/event countdowns, skeletons, empty states, responsive
  behavior, dark mode, typed API hooks, and translations.
- Added a development fixture covering every lifecycle, status, urgency band,
  owner-inheritance case, checklist, note, and ungrouped workstream.
- Reviewed PR #31 and fixed its two blockers: explicit `null` on non-nullable
  update fields now returns 422, and workstream pointer release plus deletion
  is atomic.
- Removed shallow `StepContext` wrappers, consolidated calendar-day helpers,
  shared blocked-state UI logic, added screen-reader status labels, and handled
  the singular “yesterday” label.

## Domain and response design

- `Workstream.getLifecycle()`, `Workstream.nearestDeadlineStep()`, and
  `Step.getStatus()` own entity-specific derived state. `resolveOwner()` remains
  a cross-entity function; the web owns its countdown-only `daysUntil()` helper.
- Overview user display data appears once in `users: UserSummaryDto[]`.
  Workstreams reference `ownerId`; steps expose `explicitOwnerId` and
  `effectiveOwnerId` to preserve assignment versus inheritance.
- `nearestDeadlineStepId` references the authoritative inline step rather than
  duplicating its name/date. Event and deadline dates remain stable API data;
  the web derives countdown labels and refreshes them at local midnight.
- The canonical `ProjectDto` is reused. Overview-only DTOs exist only where the
  response shape materially differs from the entity’s normal output.

## Persistence design

- Persistence flows `Controller → Service → Repository → EntityManager`.
  Services/controllers do not inject an EntityManager or built-in MikroORM
  repository.
- Each persistence concern has one concrete repository—no speculative
  interface/implementation pair or generic base repository.
- Repositories accept/return entities, IDs, criteria, or query-specific entity
  graphs, never DTOs. Services instantiate/mutate entities from input DTOs;
  services or controllers map entities to output DTOs.
- Repository saves use MikroORM 7’s supported `persist(entity)` then `flush()`.
  The overview’s query-focused repository owns eager loading and its
  repeatable-read transaction.
- `Workstream` and `Step` expose neutral collection accessors so DTO mapping
  never touches MikroORM `Collection` APIs.

## Decisions and learnings

- One project aggregate module avoids artificial cross-feature boundaries for
  tightly coupled entities and matches the API contract.
- Nearest deadline means the earliest unpassed date, overdue included.
- Entity methods are used instead of getters because TsMorph treats getters as
  required readonly entity properties.
- Nullable entity fields use `Opt<T> | null`, not `Opt<T | null>`.
- `MikroOrmModule.forFeature` remains necessary for entity discovery with
  `autoLoadEntities`; it is not repository plumbing.
- The web OpenAPI alias must use indexed access (`components['schemas']`);
  dotted access silently reduced DTOs to `any`.
- Local `dist` output can hide a missing monorepo task dependency. Compiled
  workspace packages must build before downstream type-check and lint tasks in
  clean CI; Turbo now encodes that dependency. `daysUntil()` stayed in the web
  because a utility should move to `shared` only with real cross-package users.

## Status

PR #31 is ready to merge. Formatting, lint, types, 128 unit/component tests,
and 62 API E2E tests pass after rebasing onto `main`. Regenerated OpenAPI types
have no diff. Next:
[#19](https://github.com/jeremy-dardour/wedding-planner/issues/19), the
read-only detail slide-over.
