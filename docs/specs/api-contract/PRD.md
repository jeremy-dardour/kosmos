# API Contract: REST Endpoints & DTOs

Status: ready-for-agent

The REST API for V1. Translates the entity schema
([entity-schema-design.md](../../entity-schema-design.md)), pipeline state
machine ([ADR 0005](../../adr/0005-workstream-pipeline-state-machine.md)), and
the overview UI ([design](../../prototype/overview-editing/HANDOFF.md)) into
endpoints, DTOs, and a read model. Follows the template conventions in
[apps/api/STANDARDS.md](../../../apps/api/STANDARDS.md).

---

## Design principles

1. **One overview call.** The overview loads everything in one GET —
   Project with nested Groups, Workstreams, Steps. At 20–50 workstreams × ~10
   steps this is a few KB; no pagination needed.
2. **Workstream commands own aggregate changes.** `advance` is a named action
   because pointer movement is not a generic field update. Pipeline editing
   replaces the complete current/future editable tail in one atomic Workstream
   command.
3. **Derived state in responses, not in the DB.** Workstream `lifecycle`,
   Step `status`, owner inheritance, nearest deadline — all computed at read time
   and included in output DTOs.
4. **Atomic pipeline editing, focused immediate actions.** Structural Step and
   checklist changes are saved together through the Workstream. Notes remain
   flat CRUD, and checklist done/undone has a focused immediate endpoint.
5. **No pagination, no filtering on the API.** The UI has client-side filters
   (owner, group). At this data volume, the server returns everything and the
   client filters.
6. **One output DTO per entity by default.** Aggregate responses compose the
   canonical entity DTOs. A read-model-specific entity DTO is justified only
   when its representation is materially different, not for a subset or a few
   additional derived fields.

---

## Module structure

A single `project` module owns Project, Group, Workstream, Step, Note and
ChecklistItem. The `user` module owns the authenticated-user endpoint and user
registration.

| Controller                | Owns                                           |
| ------------------------- | ---------------------------------------------- |
| `ProjectController`       | Project CRUD + overview read model             |
| `GroupController`         | Group CRUD                                     |
| `WorkstreamController`    | Workstream CRUD + `advance` + pipeline editing |
| `NoteController`          | Note CRUD (author-guarded)                     |
| `ChecklistItemController` | Immediate done/undone toggle                   |
| `UserController`          | Authenticated user (`/users/me`)               |

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

### Workstream

| Method   | Path                               | Body                  | Response        | Notes                                  |
| -------- | ---------------------------------- | --------------------- | --------------- | -------------------------------------- |
| `POST`   | `/projects/:projectId/workstreams` | `CreateWorkstreamDto` | `WorkstreamDto` |                                        |
| `PATCH`  | `/workstreams/:id`                 | `UpdateWorkstreamDto` | `WorkstreamDto` |                                        |
| `DELETE` | `/workstreams/:id`                 | —                     | `204`           | Cascades steps, notes, checklist items |
| `POST`   | `/workstreams/:id/advance`         | `AdvanceDto`          | `WorkstreamDto` | Pipeline action — see below            |
| `PUT`    | `/workstreams/:id/pipeline`        | `UpdatePipelineDto`   | `WorkstreamDto` | Atomically replaces the editable tail  |

No standalone `GET` for workstreams — the overview endpoint provides the
canonical `WorkstreamDto` data needed by both cards and the detail panel.
Mutations return the updated entity DTO, but the web invalidates the overview
query as its correctness path because one mutation may change several derived
or grouped values.

**`advance` is the single pipeline action.** The server dispatches by lifecycle:

- **NotStarted → Active:** starts the workstream (sets first step current).
  `outcome` must not be provided (400 if present — nothing has finished yet).
  Rejected with 409 if the workstream has zero steps.
- **Active → Active / Complete:** records the outcome on the current step
  (defaults to `done`), moves the pointer. On the last step, completes the
  workstream instead.
- **Complete → 409:** workstream is already finished.

### Pipeline editing

`PUT /workstreams/:id/pipeline` submits the ordered, complete desired state of
the Workstream's current/future editable tail. Mutability follows Decision 33:

- **Past steps** (have an outcome): frozen — no PATCH, no DELETE, no reorder.
  Only notes can still be appended.
- **Current step** (at the pointer): attributes editable (name, deadline, owner,
  blocked), but no structural changes (no delete, no reorder).
- **Future steps** (after the pointer): fully mutable — create, edit, delete,
  reorder.

Existing IDs preserve entities, missing IDs create entities, omitted future IDs
delete entities, and array order defines positions. The current Step of an
Active Workstream must remain present and first. Past Steps are not submitted.
The Workstream is locked before validation, and the whole replacement commits
or rolls back as one transaction.

`expectedUpdatedAt` is the optimistic-concurrency token captured when editing
begins. Every pipeline-affecting mutation touches the Workstream timestamp.
A mismatched token returns 409 `pipeline-stale`, preventing a stale draft from
overwriting another user's changes.

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

Checklist structure and names are part of the atomic pipeline editor. The
focused endpoint below supports the frequent done/undone interaction without
entering edit mode:

| Method  | Path                   | Body                     | Response           |
| ------- | ---------------------- | ------------------------ | ------------------ |
| `PATCH` | `/checklist-items/:id` | `ToggleChecklistItemDto` | `ChecklistItemDto` |

It is allowed on current and future Steps, rejected with `step-frozen` on past
Steps, and atomically touches the parent Workstream's `updatedAt`.

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

### UpdatePipelineDto

```ts
expectedUpdatedAt!: string;          // @IsDateString
steps!: EditableStepDto[];           // ordered current/future editable tail
```

### EditableStepDto

```ts
id?: string;                         // existing entity; absent means create
name!: string;
deadline!: string | null;
ownerId!: string | null;             // null means inherit from workstream
blocked!: boolean;
checklistItems!: EditableChecklistItemDto[];
```

### EditableChecklistItemDto

```ts
id?: string;                         // existing entity; absent means create
name!: string;
done!: boolean;
```

### CreateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### UpdateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### ToggleChecklistItemDto

```ts
done!: boolean;
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
| 409    | Any mutation on a past step (attributes or structure)    | `step-frozen`                |
| 409    | Structural mutation (delete/reorder) on current step     | `step-not-deletable`         |
| 409    | Mutation on a checklist item whose parent step is frozen | `step-frozen`                |
| 409    | Submitted editable tail is inconsistent                  | `pipeline-mismatch`          |
| 409    | Pipeline changed since the editor opened                 | `pipeline-stale`             |
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
- **Detail flow.** The selected workstream is stored as an ID and derived from
  the current overview query data. Opening the detail panel does not refetch the
  workstream; it only calls `GET /workstreams/:workstreamId/notes`. That endpoint
  returns all notes across the workstream's steps, newest first, each with
  `stepId`.
- **Mutation invalidation.** Project, group, workstream, step, checklist and
  advance mutations invalidate the overview query. Note mutations invalidate
  only the selected workstream's notes query while the overview contains no
  note data or counts. If that changes, note mutations invalidate both.
- **Pipeline-edit transaction.** The repository locks and loads the Workstream
  aggregate, validates the submitted exact editable tail, defers the ordered
  unique constraints, applies every Step/checklist change, and flushes once.
- **Step mutability checks.** Past Steps are excluded and frozen. The current
  Step must remain structurally present but its attributes/checklist are
  editable. Future Steps are fully mutable. NotStarted means every Step is
  future; Complete has no editable insertion zone.
- **`advance` persistence.** The repository performs the atomic entity load and
  save under a transaction with concurrency protection; the service never
  receives an EntityManager. The response is the canonical `WorkstreamDto`, and
  the web then invalidates the overview query.
