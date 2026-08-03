# V1 API Contract: REST Endpoints & DTOs

Status: ready-for-agent

The V1 design-time API spec, sibling of the [V1 Product PRD](./PRD.md) — the
**live** contract is the OpenAPI document the running API serves
(`/openapi.yaml` → `packages/api-contracts`). This doc records the intended
shape and the reasoning; when the two disagree after implementation, OpenAPI
wins and this doc gets amended.

Translates the entity schema
([entity-schema-design.md](../../entity-schema-design.md)), pipeline state
machine ([ADR 0005](../../adr/0005-workstream-pipeline-state-machine.md)), and
the inline overview UI ([design](../../prototype/overview-editing/HANDOFF.md))
into endpoints, DTOs, and a read model. Follows the template conventions in
[apps/api/STANDARDS.md](../../../apps/api/STANDARDS.md).

---

## Design principles

1. **One overview call, granular writes.** The overview loads everything in one
   GET — Project with nested Groups, Workstreams, Steps (and per-step note
   counts). At 20–50 workstreams × ~10 steps this is a few KB; no pagination
   needed. Writes go the other way: each inline edit is its own small,
   immediately-committed mutation (the inline overview design has no editing
   session and no Save button).
2. **Workstream commands own pointer changes.** `advance` is a named action
   because pointer movement is not a generic field update.
3. **Derived state in responses, not in the DB.** Workstream `lifecycle`,
   Step `status`, owner inheritance, nearest deadline — all computed at read time
   and included in output DTOs.
4. **A mutation returns the smallest entity it changed.** A step-field PATCH
   returns the `StepDto`; structural or pointer-moving operations (create,
   delete, reorder, advance) return the `WorkstreamDto`, because positions,
   statuses and lifecycle shift together. The client patches responses into
   its cached aggregate instead of refetching per mutation.
5. **Per-operation invariant validation instead of an edit-session token.**
   Field edits are last-write-wins (2–6 cooperating users); every operation is
   validated against current server state (frozen past, insertion zone,
   membership) and returns 409 only when a real invariant broke. There is no
   `expectedUpdatedAt` token — the atomic whole-tail pipeline replace it
   guarded is removed.
6. **No pagination, no filtering on the API.** The UI has client-side filters
   (owner, group). At this data volume, the server returns everything and the
   client filters.
7. **One output DTO per entity by default.** Aggregate responses compose the
   canonical entity DTOs. A read-model-specific entity DTO is justified only
   when its representation is materially different, not for a subset or a few
   additional derived fields.

---

## Module structure

A single `project` module owns Project, Group, Workstream, Step, Note and
ChecklistItem. The `user` module owns the authenticated-user endpoint and user
registration.

| Controller                | Owns                                                |
| ------------------------- | --------------------------------------------------- |
| `ProjectController`       | Project CRUD + overview read model + ordering       |
| `GroupController`         | Group CRUD                                          |
| `WorkstreamController`    | Workstream CRUD + `advance` + step create/order     |
| `StepController`          | Step field edits + delete + checklist item creation |
| `NoteController`          | Note CRUD (author-guarded)                          |
| `ChecklistItemController` | Checklist item rename / toggle / delete             |
| `UserController`          | Authenticated user (`/users/me`)                    |

---

## Endpoints

### Project

One project in V1. CRUD is minimal — create once (seed or first-run), update
name/eventDate.

| Method   | Path            | Body               | Response       | Notes                      |
| -------- | --------------- | ------------------ | -------------- | -------------------------- |
| `GET`    | `/projects`     | —                  | `ProjectDto[]` | Returns the single project |
| `GET`    | `/projects/:id` | —                  | `ProjectDto`   |                            |
| `POST`   | `/projects`     | `CreateProjectDto` | `ProjectDto`   |                            |
| `PATCH`  | `/projects/:id` | `UpdateProjectDto` | `ProjectDto`   |                            |
| `DELETE` | `/projects/:id` | —                  | `204`          | Cascades everything        |

`GET /projects` exists so the client can discover the project ID on first load.

### Overview (read model)

| Method | Path                            | Response      | Notes                                       |
| ------ | ------------------------------- | ------------- | ------------------------------------------- |
| `GET`  | `/projects/:projectId/overview` | `OverviewDto` | The single aggregate read. See §Output DTOs |

Returns the full tree: project + groups + workstreams (with inline steps, derived
lifecycle, nearest deadline, owner inheritance resolved). This is the only
endpoint the overview calls on load.

### Group

| Method   | Path                          | Body             | Response     |
| -------- | ----------------------------- | ---------------- | ------------ |
| `GET`    | `/projects/:projectId/groups` | —                | `GroupDto[]` |
| `POST`   | `/projects/:projectId/groups` | `CreateGroupDto` | `GroupDto`   |
| `PATCH`  | `/groups/:id`                 | `UpdateGroupDto` | `GroupDto`   |
| `DELETE` | `/groups/:id`                 | —                | `204`        |

### Manual ordering

Both levels of the overview's drag & drop persist as integer `position`
columns — on `Group` scoped to the project, on `Workstream` scoped to its
group (ungrouped is its own scope). One drag sends the whole ordered id list
for that scope; the server validates the ids are exactly the scope's current
membership (409 `order-mismatch` otherwise) and rewrites contiguous positions
in one locked transaction. The unique position constraints are generated
`deferrable initially deferred`, so transient collisions during the rewrite
resolve at commit — no temporary-position phase is needed. Workstream
membership is validated against the scope's **live** (NotStarted/Active)
workstreams; Complete siblings keep sharing the scope's position sequence and
are renumbered to trail the live tail in their existing relative order (the
response returns only the live workstreams, in the new order).

| Method | Path                                    | Body                    | Response          | Notes                                          |
| ------ | --------------------------------------- | ----------------------- | ----------------- | ---------------------------------------------- |
| `PUT`  | `/projects/:projectId/group-order`      | `ReorderGroupsDto`      | `GroupDto[]`      | All the project's groups, in order             |
| `PUT`  | `/projects/:projectId/workstream-order` | `ReorderWorkstreamsDto` | `WorkstreamDto[]` | One group's scope per call (`groupId` or null) |

A migration seeds positions from today's alphabetical order so nothing visibly
moves on upgrade. `POST /projects/:projectId/workstreams` inserts at position 0
(top of its group), shifting siblings server-side. Changing a workstream's
group appends it to the **top** of the target scope. `POST
/projects/:projectId/groups` appends the new group at the **end** of the
project's groups (`max + 1`, hole-safe after deletes) — new groups are rare
and should not jump above existing ones.

Workstream reorder is routed on the **project** (with `groupId` in the body)
rather than on a group resource because the ungrouped scope has no group row
to address; one route serves every scope uniformly.

### Workstream

| Method   | Path                               | Body                  | Response        | Notes                                  |
| -------- | ---------------------------------- | --------------------- | --------------- | -------------------------------------- |
| `POST`   | `/projects/:projectId/workstreams` | `CreateWorkstreamDto` | `WorkstreamDto` | Inserted at the top of its group       |
| `PATCH`  | `/workstreams/:id`                 | `UpdateWorkstreamDto` | `WorkstreamDto` |                                        |
| `DELETE` | `/workstreams/:id`                 | —                     | `204`           | Cascades steps, notes, checklist items |
| `POST`   | `/workstreams/:id/advance`         | `AdvanceDto`          | `WorkstreamDto` | Pipeline action — see below            |

No standalone `GET` for workstreams — the overview endpoint provides the
canonical `WorkstreamDto` data, and every structural mutation returns the
updated `WorkstreamDto` for the client to patch into its cached aggregate
(design principle 4).

**`advance` is the single pipeline action.** The server dispatches by lifecycle:

- **NotStarted → Active:** starts the workstream (sets first step current).
  `outcome` must not be provided (400 if present — nothing has finished yet).
  Rejected with 409 if the workstream has zero steps.
- **Active → Active / Complete:** records the outcome on the current step
  (defaults to `done`), moves the pointer. On the last step, completes the
  workstream instead.
- **Complete → 409:** workstream is already finished.

### Step editing (granular)

The inline overview commits each edit as its own operation — there is no
editing session, so the former atomic whole-tail
`PUT /workstreams/:id/pipeline` (and its `expectedUpdatedAt` token) is
**removed**. Every operation validates the mutability rules (Decision 33)
against current server state:

- **Past steps** (have an outcome): frozen — no PATCH, no DELETE, no reorder.
  Only notes can still be appended.
- **Current step** (at the pointer): attributes editable (name, deadline, owner,
  blocked), but no structural changes (no delete, no reorder).
- **Future steps** (after the pointer): fully mutable — create, edit, delete,
  reorder.

| Method   | Path                          | Body              | Response        | Notes                                                 |
| -------- | ----------------------------- | ----------------- | --------------- | ----------------------------------------------------- |
| `POST`   | `/workstreams/:id/steps`      | `CreateStepDto`   | `WorkstreamDto` | Insert at `position`; only where `position` is future |
| `PATCH`  | `/steps/:id`                  | `UpdateStepDto`   | `StepDto`       | Field edits; current or future steps only             |
| `DELETE` | `/steps/:id`                  | —                 | `WorkstreamDto` | Future steps only; siblings renumber                  |
| `PUT`    | `/workstreams/:id/step-order` | `ReorderStepsDto` | `WorkstreamDto` | The complete future tail's ids, in order              |

- The client creates a step **only once it has a name**: clicking an insert
  point opens a local ghost; the `POST` fires on the first non-empty name
  commit. An empty `name` is rejected (422) on create and on rename.
- `POST` validates the insertion zone (`position > currentIndex`); if the
  position became illegal since the ghost opened (someone advanced), it
  returns 409 `step-insertion-illegal` and the client discards the ghost with
  a message.
- `PUT step-order` submits every future step id exactly once; a list that does
  not match the current future tail returns 409 `order-mismatch`. Positions
  are rewritten in one transaction under the deferred unique constraint.
- Field edits are **last-write-wins** — no concurrency token. Structural
  invariants are re-validated per operation, which is what actually protects
  the pipeline; simultaneous field edits by 2–6 cooperating users are not a
  failure mode worth a token.

### Note

Author-editable/deletable (Decision 39) — the API compares `note.author?.id`
with the server-trusted authenticated user ID. The client never submits an
author ID. Notes can be appended to any step (including past steps — Decision
33).

| Method   | Path                               | Body            | Response    | Notes                                                                                                         |
| -------- | ---------------------------------- | --------------- | ----------- | ------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/workstreams/:workstreamId/notes` | —               | `NoteDto[]` | All notes across all steps, newest first with a stable tie-breaker. Each includes `stepId`. Loaded on demand. |
| `POST`   | `/steps/:stepId/notes`             | `CreateNoteDto` | `NoteDto`   | Sets `author` from the authenticated user                                                                     |
| `PATCH`  | `/notes/:id`                       | `UpdateNoteDto` | `NoteDto`   | Author only; 403 otherwise                                                                                    |
| `DELETE` | `/notes/:id`                       | —               | `204`       | Author only; 403 otherwise                                                                                    |

### Checklist Item

Flat item-level CRUD, matching the granular step model. All operations are
allowed on current and future Steps and rejected with `step-frozen` on past
Steps.

| Method   | Path                             | Body                     | Response           | Notes                       |
| -------- | -------------------------------- | ------------------------ | ------------------ | --------------------------- |
| `POST`   | `/steps/:stepId/checklist-items` | `CreateChecklistItemDto` | `ChecklistItemDto` | Appended at the end         |
| `PATCH`  | `/checklist-items/:id`           | `UpdateChecklistItemDto` | `ChecklistItemDto` | Rename and/or toggle `done` |
| `DELETE` | `/checklist-items/:id`           | —                        | `204`              | Siblings renumber           |

No standalone `GET` — checklist items are included inline in the overview's step
data (they're small: name + boolean + position).

### User

Users are created via the auth upsert (see auth PRD), not via CRUD endpoints.
The overview's canonical `users` directory supplies owner and author display
data. The auth module already calls `/users/me` and exposes that result through
`AuthSession`; feature code does not fetch it again.

| Method | Path        | Response         | Notes                      |
| ------ | ----------- | ---------------- | -------------------------- |
| `GET`  | `/users/me` | `CurrentUserDto` | Current authenticated user |

---

## Input DTOs

### CreateProjectDto

```ts
name!: string;                       // @IsString, @MaxLength(255)
eventDate?: string | null;           // @IsOptional, @IsDateString (YYYY-MM-DD)
```

### UpdateProjectDto

```ts
name?: string;                       // @IsOptional, @IsString, @MaxLength(255)
eventDate?: string | null;           // @IsOptional, @IsDateString
```

### CreateGroupDto

```ts
name!: string;                       // @MaxLength(255)
color!: string;                      // @Matches(/^#[0-9a-fA-F]{6}$/)
```

### UpdateGroupDto

```ts
name?: string;
color?: string;
```

### CreateWorkstreamDto

```ts
name!: string;                       // @MaxLength(255)
icon!: string;                       // @MaxLength(255) — emoji or icon name
groupId?: string | null;             // @IsOptional, @IsUUID
ownerId?: string | null;             // @IsOptional, @IsUUID
```

### UpdateWorkstreamDto

```ts
name?: string;
icon?: string;
groupId?: string | null;             // null to ungroup
ownerId?: string | null;             // null to unassign
```

### AdvanceDto

```ts
outcome?: 'done' | 'skipped';       // @IsOptional, @IsEnum — defaults to 'done'
                                     // Must not be provided when workstream is NotStarted
                                     // (nothing has finished — 400 if present).
```

### CreateStepDto

```ts
name!: string;                       // @IsNotEmpty, @MaxLength(255) — empty rejected
position!: number;                   // @IsInt, @Min(1) — must be in the future zone
deadline?: string | null;            // @IsOptional, @IsDateString
ownerId?: string | null;             // @IsOptional, @IsUUID — null inherits
```

### UpdateStepDto

```ts
name?: string;                       // @IsNotEmpty when present — empty rejected
deadline?: string | null;            // null to clear
ownerId?: string | null;             // null restores inheritance
blocked?: boolean;                   // accepted on current and future steps (inert off the pointer); frozen past steps 409
```

### ReorderStepsDto

```ts
ids!: string[];                      // the complete future tail, in order
```

### ReorderWorkstreamsDto

```ts
groupId!: string | null;             // the scope; null = the ungrouped bucket
ids!: string[];                      // every live workstream in that scope, in order
```

### ReorderGroupsDto

```ts
ids!: string[];                      // every group in the project, in order
```

### CreateChecklistItemDto

```ts
name!: string;                       // @IsNotEmpty, @MaxLength(255)
```

### CreateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### UpdateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### UpdateChecklistItemDto

```ts
name?: string;                       // @IsNotEmpty when present
done?: boolean;
```

---

## Output DTOs

### OverviewDto (the aggregate read)

The single response for `GET /projects/:projectId/overview`. Contains everything
the overview needs for first paint.

```ts
class OverviewDto {
  project!: ProjectDto;
  groups!: GroupDto[];
  workstreams!: WorkstreamDto[];
  users!: UserSummaryDto[]; // canonical display data for owner IDs
}

class UserSummaryDto {
  id!: string;
  name!: string;
  avatarUrl?: string | null;
}
```

### WorkstreamDto

The canonical workstream representation, composed into `OverviewDto` and
returned by workstream mutations. Notes remain a separate on-demand resource.

```ts
class WorkstreamDto {
  id!: string;
  name!: string;
  icon!: string;
  groupId?: string | null;
  position!: number; // manual order within its group scope
  lifecycle!: 'not_started' | 'active' | 'complete';
  ownerId?: string | null;
  currentStepId?: string | null;
  startedAt?: string | null; // ISO datetime
  completedAt?: string | null; // ISO datetime
  nearestDeadlineStepId?: string | null; // derived
  steps!: StepDto[];
  createdAt!: string;
  updatedAt!: string;
}
```

### StepDto

```ts
class StepDto {
  id!: string;
  name!: string;
  position!: number;
  status!: 'not_started' | 'in_progress' | 'done' | 'skipped';
  blocked!: boolean;
  deadline?: string | null;
  outcome?: 'done' | 'skipped' | null;
  outcomeAt?: string | null;
  explicitOwnerId?: string | null; // null means inherit from workstream
  effectiveOwnerId?: string | null; // resolved after inheritance
  noteCount!: number; // derived — drives the overview's per-step note markers
  checklistItems!: ChecklistItemDto[];
  createdAt!: string;
  updatedAt!: string;
}
```

### NoteDto

```ts
class NoteDto {
  id!: string;
  stepId!: string; // which step this note belongs to
  content!: string;
  author?: UserSummaryDto | null;
  createdAt!: string;
  updatedAt!: string;
}
```

### ChecklistItemDto

```ts
class ChecklistItemDto {
  id!: string;
  name!: string;
  position!: number;
  done!: boolean;
  createdAt!: string;
  updatedAt!: string;
}
```

### GroupDto

```ts
class GroupDto {
  id!: string;
  name!: string;
  color!: string;
  position!: number; // manual order within the project
  createdAt!: string;
  updatedAt!: string;
}
```

### ProjectDto

```ts
class ProjectDto {
  id!: string;
  name!: string;
  eventDate?: string | null;
  createdAt!: string;
  updatedAt!: string;
}
```

### CurrentUserDto

```ts
class CurrentUserDto {
  id!: string;
  email!: string;
  name!: string;
  avatarUrl?: string | null;
}
```

---

## Error responses

Follow the template's RFC 9457 format (`ProblemDetailsFilter`). Domain-specific
error cases:

| Status | When                                                     | `type` slug                  |
| ------ | -------------------------------------------------------- | ---------------------------- |
| 404    | Entity not found                                         | (MikroORM `NotFoundError`)   |
| 409    | `advance` on Complete workstream                         | `workstream-not-advanceable` |
| 409    | `advance` on empty workstream (zero steps)               | `workstream-empty`           |
| 400    | `advance` with outcome on NotStarted workstream          | (validation error)           |
| 422    | Empty step or checklist item name (create or rename)     | (validation error)           |
| 409    | Any mutation on a past step (attributes or structure)    | `step-frozen`                |
| 409    | Structural mutation (delete/reorder) on current step     | `step-not-deletable`         |
| 409    | Mutation on a checklist item whose parent step is frozen | `step-frozen`                |
| 409    | Step insert at a position not in the future zone         | `step-insertion-illegal`     |
| 409    | Reorder ids do not match the scope's current membership  | `order-mismatch`             |
| 403    | Edit/delete note by non-author                           | `not-note-author`            |

---

## Derived state computation (server-side)

These are computed at read time by entity behavior or domain functions, not
stored:

| Field                              | Logic                                                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `workstream.lifecycle`             | `(startedAt, completedAt)` → `not_started` / `active` / `complete` (ADR 0005)                                                                   |
| `step.status`                      | Position relative to `currentStepId`: before pointer with outcome → `done`/`skipped`; at pointer → `in_progress`; after pointer → `not_started` |
| `step.effectiveOwnerId`            | `step.ownerId ?? workstream.ownerId`; `explicitOwnerId` preserves whether inheritance applies                                                   |
| `workstream.nearestDeadlineStepId` | Among unpassed steps with a deadline, the ID of the one with the earliest date (includes overdue)                                               |
| `step.noteCount`                   | Count of the step's notes, computed in the aggregate query (no note bodies in the overview)                                                     |
| `step.checklistItems`              | Full items included inline in overview (small payload)                                                                                          |

---

## Notes on implementation

- **Overview consistency and performance.** The project, groups, populated
  workstreams and user summaries are read inside one read-only repeatable-read
  transaction, so the aggregate represents one database snapshot. At 20–50
  workstreams this is cheap. Notes are excluded (loaded on demand).
- **Countdown presentation.** The API returns stable calendar dates. The client
  derives event and deadline countdown labels and refreshes them at local
  midnight, so a mounted overview does not retain yesterday's relative values.
- **Notes flow.** The selected workstream is stored as an ID and derived from
  the current overview query data. Note markers render from `step.noteCount`;
  a thread is fetched only when a marker or step editor opens, via
  `GET /workstreams/:workstreamId/notes` (all notes across the workstream's
  steps, newest first, each with `stepId`).
- **Cache maintenance, not per-mutation refetch.** Each mutation response (the
  smallest changed entity, principle 4) is patched into the cached overview
  aggregate. A single **trailing invalidate** reconciles server-derived fields
  (lifecycle, nearest deadline, effective owners) after a burst of edits, and
  is **deferred while any inline input has focus** so a refetch can never
  clobber an in-progress edit. Note mutations patch `noteCount` and invalidate
  the notes query. Full aggregate refetches happen on load, window refocus and
  conflict recovery.
- **Throttling.** The current 30-requests/minute authenticated throttle is
  sized against abuse, not an interactive editor — commit-on-blur bursts hit
  it (measured on the prototype). Raise the authenticated limit (e.g.
  120/min) alongside this contract.
- **Step mutability checks.** Every step operation re-validates against
  current server state: past Steps are frozen, the current Step allows
  attribute/checklist edits but no structural change, future Steps are fully
  mutable. NotStarted means every Step is future; Complete has no editable
  insertion zone.
- **Ordered mutations.** Step insert/delete/reorder and the workstream/group
  reorder endpoints each run in one transaction; the position unique
  constraints are `deferrable initially deferred`, so contiguous final
  positions are checked only at commit.
- **`advance` persistence.** The repository performs the atomic entity load and
  save under a transaction with concurrency protection; the service never
  receives an EntityManager. The response is the canonical `WorkstreamDto`,
  which the web patches into its cache.
