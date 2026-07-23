# API Contract: REST Endpoints & DTOs

Status: ready-for-agent

The REST API for V1. Translates the entity schema
([entity-schema-design.md](../../entity-schema-design.md)), pipeline state
machine ([ADR 0005](../../adr/0005-workstream-pipeline-state-machine.md)), and
the Pipeline Stack UI ([prototype](../../prototype/timeline/README.md)) into
endpoints, DTOs, and a read model. Follows the template conventions in
[apps/api/STANDARDS.md](../../../apps/api/STANDARDS.md).

---

## Design principles

1. **One overview call.** The Pipeline Stack UI loads everything in one GET —
   Project with nested Groups, Workstreams, Steps. At 20–50 workstreams × ~10
   steps this is a few KB; no pagination needed.
2. **State-machine actions are named RPCs, not PATCH.** `start` and `advance`
   are `POST` actions on the workstream — the pointer logic is too specific to
   express as a generic field update. CRUD mutations (name, deadline, owner) use
   PATCH.
3. **Derived state in responses, not in the DB.** Workstream `lifecycle`,
   Step `status`, owner inheritance, nearest deadline — all computed at read time
   and included in output DTOs.
4. **Flat CRUD for sub-entities.** Steps, Notes, ChecklistItems are nested
   _conceptually_ but have their own endpoints scoped under their parent. This
   matches the template's one-controller-per-entity pattern while keeping URLs
   navigable.
5. **No pagination, no filtering on the API.** The UI has client-side filters
   (owner, group). At this data volume, the server returns everything and the
   client filters.

---

## Module structure

A single `project` module owns everything — Project, Group, Workstream, Step,
Note, ChecklistItem, User. No cross-module import issues, no artificial
boundaries at this scale.

| Controller                | Owns                                   |
| ------------------------- | -------------------------------------- |
| `ProjectController`       | Project CRUD + overview read model     |
| `GroupController`         | Group CRUD                             |
| `WorkstreamController`    | Workstream CRUD + `start` / `advance`  |
| `StepController`          | Step CRUD + reorder                    |
| `NoteController`          | Note CRUD (author-guarded)             |
| `ChecklistItemController` | ChecklistItem CRUD + reorder           |
| `UserController`          | User read-only (`/users`, `/users/me`) |

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
endpoint the Pipeline Stack overview calls on load.

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

No standalone `GET` for workstreams — the overview endpoint provides all
workstream data. Mutations return the updated `WorkstreamDto` for the client to
patch its local state.

**`advance` is the single pipeline action.** The server dispatches by lifecycle:

- **NotStarted → Active:** starts the workstream (sets first step current).
  `outcome` must not be provided (400 if present — nothing has finished yet).
  Rejected with 409 if the workstream has zero steps.
- **Active → Active / Complete:** records the outcome on the current step
  (defaults to `done`), moves the pointer. On the last step, completes the
  workstream instead.
- **Complete → 409:** workstream is already finished.

### Step

Scoped under workstream. Mutability follows Decision 33:

- **Past steps** (have an outcome): frozen — no PATCH, no DELETE, no reorder.
  Only notes can still be appended.
- **Current step** (at the pointer): attributes editable (name, deadline, owner,
  blocked), but no structural changes (no delete, no reorder).
- **Future steps** (after the pointer): fully mutable — create, edit, delete,
  reorder.

The service loads the parent workstream to determine a step's position relative
to the pointer. Violations return 409.

| Method   | Path                                       | Body              | Response    | Notes                                           |
| -------- | ------------------------------------------ | ----------------- | ----------- | ----------------------------------------------- |
| `POST`   | `/workstreams/:workstreamId/steps`         | `CreateStepDto`   | `StepDto`   | Appended at end, or at `position` (future only) |
| `PATCH`  | `/steps/:id`                               | `UpdateStepDto`   | `StepDto`   | Current + future only; 409 on past              |
| `DELETE` | `/steps/:id`                               | —                 | `204`       | Future only; 409 on past/current                |
| `POST`   | `/workstreams/:workstreamId/steps/reorder` | `ReorderStepsDto` | `StepDto[]` | Full position list for future steps             |

### Note

Author-editable/deletable (Decision 39) — the API checks `authorId` matches
the authenticated user. Notes can be appended to any step (including past steps
— Decision 33).

| Method   | Path                               | Body            | Response    | Notes                                                                                                |
| -------- | ---------------------------------- | --------------- | ----------- | ---------------------------------------------------------------------------------------------------- |
| `GET`    | `/workstreams/:workstreamId/notes` | —               | `NoteDto[]` | All notes across all steps; chronological. Each includes `stepId`. Used when the detail panel opens. |
| `POST`   | `/steps/:stepId/notes`             | `CreateNoteDto` | `NoteDto`   | Sets authorId from auth                                                                              |
| `PATCH`  | `/notes/:id`                       | `UpdateNoteDto` | `NoteDto`   | Author only; 403 otherwise                                                                           |
| `DELETE` | `/notes/:id`                       | —               | `204`       | Author only; 403 otherwise                                                                           |

### Checklist Item

Scoped under step. Lightweight CRUD — toggle done, reorder, add/remove.
Same mutability rules as steps: checklist items on past steps are frozen;
current-step items are editable; future-step items are fully mutable.

| Method   | Path                                     | Body                       | Response             |
| -------- | ---------------------------------------- | -------------------------- | -------------------- |
| `POST`   | `/steps/:stepId/checklist-items`         | `CreateChecklistItemDto`   | `ChecklistItemDto`   |
| `PATCH`  | `/checklist-items/:id`                   | `UpdateChecklistItemDto`   | `ChecklistItemDto`   |
| `DELETE` | `/checklist-items/:id`                   | —                          | `204`                |
| `POST`   | `/steps/:stepId/checklist-items/reorder` | `ReorderChecklistItemsDto` | `ChecklistItemDto[]` |

No standalone `GET` — checklist items are included inline in the overview's step
data (they're small: name + boolean + position).

### User

Read-only in V1. Users are created via the auth upsert (see auth PRD), not via
API endpoints.

| Method | Path        | Response    | Notes                            |
| ------ | ----------- | ----------- | -------------------------------- |
| `GET`  | `/users`    | `UserDto[]` | All users (for owner assignment) |
| `GET`  | `/users/me` | `UserDto`   | Current authenticated user       |

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
name!: string;                       // @MaxLength(255)
position?: number;                   // @IsOptional, @IsInt, @Min(1) — append at end if omitted
deadline?: string | null;            // @IsOptional, @IsDateString
ownerId?: string | null;             // @IsOptional, @IsUUID
```

### UpdateStepDto

```ts
name?: string;
deadline?: string | null;            // null to clear
ownerId?: string | null;             // null to clear (inherit from workstream)
blocked?: boolean;
```

### ReorderStepsDto

```ts
stepIds!: string[];                  // @IsArray, @IsUUID(undefined, { each: true })
                                     // Ordered list of future-step IDs in desired order.
                                     // Must include all and only future steps.
```

### CreateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### UpdateNoteDto

```ts
content!: string;                   // @IsString, @MaxLength(5000)
```

### CreateChecklistItemDto

```ts
name!: string;                       // @MaxLength(255)
```

### UpdateChecklistItemDto

```ts
name?: string;
done?: boolean;
```

### ReorderChecklistItemsDto

```ts
itemIds!: string[];                  // @IsArray, @IsUUID(undefined, { each: true })
```

---

## Output DTOs

### OverviewDto (the aggregate read)

The single response for `GET /projects/:projectId/overview`. Contains everything
the Pipeline Stack needs for first paint.

```ts
class OverviewDto {
  project!: OverviewProjectDto;
  groups!: GroupDto[];
  workstreams!: OverviewWorkstreamDto[];
  users!: UserDto[]; // all users (for owner avatars/filter)
}

class OverviewProjectDto {
  id!: string;
  name!: string;
  eventDate?: string | null; // ISO date (YYYY-MM-DD)
  daysUntilEvent?: number | null; // derived: days from today to eventDate
}

class OverviewWorkstreamDto {
  id!: string;
  name!: string;
  icon!: string;
  groupId?: string | null;
  lifecycle!: 'not_started' | 'active' | 'complete'; // derived
  owner?: UserSummaryDto | null; // resolved (workstream default)
  steps!: OverviewStepDto[];
  nearestDeadline?: NearestDeadlineDto | null; // derived
}

class OverviewStepDto {
  id!: string;
  name!: string;
  position!: number;
  status!: 'not_started' | 'in_progress' | 'done' | 'skipped'; // derived from pointer
  blocked!: boolean;
  deadline?: string | null; // ISO date
  outcome?: 'done' | 'skipped' | null;
  owner?: UserSummaryDto | null; // resolved: step owner ?? workstream owner
  checklistItems!: ChecklistItemDto[]; // full items (small — name + done + position)
}

class NearestDeadlineDto {
  stepName!: string;
  date!: string; // ISO date
  daysUntil!: number; // negative = overdue
}

class UserSummaryDto {
  id!: string;
  name!: string;
  avatarUrl?: string | null;
}
```

### WorkstreamDto (detail / mutation response)

Returned by workstream CRUD and `start`/`advance`. Includes nested steps with
full detail (notes, checklist items).

```ts
class WorkstreamDto {
  id!: string;
  name!: string;
  icon!: string;
  groupId?: string | null;
  lifecycle!: 'not_started' | 'active' | 'complete';
  owner?: UserSummaryDto | null;
  currentStepId?: string | null;
  startedAt?: string | null; // ISO datetime
  completedAt?: string | null; // ISO datetime
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
  owner?: UserSummaryDto | null; // resolved (inherited if null on entity)
  checklistItems!: ChecklistItemDto[];
  noteCount!: number; // count only (full notes loaded on demand)
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

### UserDto

```ts
class UserDto {
  id!: string;
  email!: string;
  name!: string;
  avatarUrl?: string | null;
  createdAt!: string;
  updatedAt!: string;
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
| 409    | Reorder list doesn't match future steps                  | `reorder-mismatch`           |
| 403    | Edit/delete note by non-author                           | `not-note-author`            |

---

## Derived state computation (server-side)

These are computed at read time by the workstream service, not stored:

| Field                            | Logic                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `workstream.lifecycle`           | `(startedAt, completedAt)` → `not_started` / `active` / `complete` (ADR 0005)                                                                   |
| `step.status`                    | Position relative to `currentStepId`: before pointer with outcome → `done`/`skipped`; at pointer → `in_progress`; after pointer → `not_started` |
| `step.owner` (resolved)          | `step.ownerId ?? workstream.ownerId` → look up User                                                                                             |
| `workstream.nearestDeadline`     | Among steps at or after the pointer with a deadline, the one with the earliest date (includes overdue — `daysUntil` is negative when past)      |
| `overviewProject.daysUntilEvent` | `eventDate - today` in days (null if no eventDate)                                                                                              |
| `step.checklistItems`            | Full items included inline in overview (small payload)                                                                                          |

---

## Notes on implementation

- **Overview performance.** One query with eager loading (Project → Workstreams →
  Steps → ChecklistItems, plus Groups and Users). MikroORM's `populate` handles
  this. At 20–50 workstreams this is cheap. Notes are excluded (loaded on demand).
- **Notes loaded on demand.** `GET /workstreams/:workstreamId/notes` returns all
  notes across all steps of that workstream in one call, each with `stepId`. Called
  once when the detail panel opens. The overview carries no note data.
- **Reorder transactions.** `ReorderStepsDto` sends the full ordered ID list of
  future steps. The service validates it matches the current future set, then
  bulk-updates positions in one transaction (deferred unique constraint allows
  this).
- **Step mutability checks.** On PATCH/DELETE of a step (or its checklist items),
  the service loads the parent workstream to determine if the step is
  past/current/future relative to the pointer. Past → 409 `step-frozen`.
  Current + structural → 409 `step-not-deletable`. Current + attribute edit → OK.
  Future → OK.
- **`advance` response.** Returns the updated `WorkstreamDto` with all steps
  re-derived — the client gets the new pointer position, the recorded outcome on
  the previous step, and the new current step's status, all in one response.
