# Entity / Schema Design

The concrete MikroORM 7 schema for V1. Translates
[CONTEXT.md](../CONTEXT.md) + [ADR 0005](./adr/0005-workstream-pipeline-state-machine.md)
into entities, columns, constraints, and module layout. Every choice here was
resolved during the Ticket 01 grilling
([session 06](./sessions/session-06-2026-07-19-schema-grilling.md#decisions)).

Follow [apps/api/STANDARDS.md](../apps/api/STANDARDS.md) for decorator style
(TsMorphMetadataProvider, TS-driven nullability, legacy decorators).

---

## Postgres enum types

```sql
CREATE TYPE step_outcome AS ENUM('done', 'skipped');
```

---

## Entities

### User

Created on first login (Google OAuth). Name and avatar refreshed on every login.

| Column      | Type           | Constraints / Notes                   |
| ----------- | -------------- | ------------------------------------- |
| `id`        | `uuid`         | PK, `defaultRaw: gen_random_uuid()`   |
| `email`     | `varchar(255)` | `unique: true`                        |
| `name`      | `varchar(255)` |                                       |
| `avatarUrl` | `text`         | Nullable. Google profile picture URL. |
| `createdAt` | `timestamptz`  | `defaultRaw: now()`                   |
| `updatedAt` | `timestamptz`  | `defaultRaw: now()`                   |

No cascade deletes _from_ User. All FKs pointing to User use
`ON DELETE SET NULL`.

---

### Project

One per deployment in V1. Generic container — "wedding" is not hardcoded.

| Column      | Type           | Constraints / Notes                   |
| ----------- | -------------- | ------------------------------------- |
| `id`        | `uuid`         | PK, `defaultRaw: gen_random_uuid()`   |
| `name`      | `varchar(255)` |                                       |
| `eventDate` | `date`         | Nullable. Calendar day (no timezone). |
| `createdAt` | `timestamptz`  | `defaultRaw: now()`                   |
| `updatedAt` | `timestamptz`  | `defaultRaw: now()`                   |

**Cascades:** `ON DELETE CASCADE` → Workstream, Group.

---

### Group

Visual/organizational label for clustering Workstreams on the overview.

| Column      | Type           | Constraints / Notes                                                         |
| ----------- | -------------- | --------------------------------------------------------------------------- |
| `id`        | `uuid`         | PK, `defaultRaw: gen_random_uuid()`                                         |
| `name`      | `varchar(255)` |                                                                             |
| `color`     | `varchar(7)`   | Hex string, e.g. `#4A90D9`. Validated in input DTO (`/^#[0-9a-fA-F]{6}$/`). |
| `projectId` | `uuid`         | FK → Project. `ON DELETE CASCADE`.                                          |
| `createdAt` | `timestamptz`  | `defaultRaw: now()`                                                         |
| `updatedAt` | `timestamptz`  | `defaultRaw: now()`                                                         |

---

### Workstream

A named track of wedding preparation work. Owns the pipeline state machine
(ADR 0005).

| Column           | Type           | Constraints / Notes                                                           |
| ---------------- | -------------- | ----------------------------------------------------------------------------- |
| `id`             | `uuid`         | PK, `defaultRaw: gen_random_uuid()`                                           |
| `name`           | `varchar(255)` |                                                                               |
| `icon`           | `varchar(255)` | Emoji or icon name (Decision 25 — representation TBD; `varchar` covers both). |
| `projectId`      | `uuid`         | FK → Project. `ON DELETE CASCADE`.                                            |
| `groupId`        | `uuid`         | Nullable. FK → Group. `ON DELETE SET NULL`.                                   |
| `defaultOwnerId` | `uuid`         | Nullable. FK → User. `ON DELETE SET NULL`.                                    |
| `startedAt`      | `timestamptz`  | Nullable. Set by `start()`.                                                   |
| `completedAt`    | `timestamptz`  | Nullable. Set by final `advance()`.                                           |
| `currentStepId`  | `uuid`         | Nullable. FK → Step. `ON DELETE RESTRICT` (must not orphan a live pointer).   |
| `createdAt`      | `timestamptz`  | `defaultRaw: now()`                                                           |
| `updatedAt`      | `timestamptz`  | `defaultRaw: now()`                                                           |

**Core invariant (ADR 0005):** `currentStepId` is non-null **⟺** Active
(`startedAt` set, `completedAt` null). Guarded in the domain service, not by a
DB constraint.

**Cascades:** `ON DELETE CASCADE` → Step (which cascades → ChecklistItem, Note).

---

### Step

An individual action within a Workstream's pipeline. Ordered by `position`.

| Column         | Type           | Constraints / Notes                                                                                      |
| -------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `id`           | `uuid`         | PK, `defaultRaw: gen_random_uuid()`                                                                      |
| `workstreamId` | `uuid`         | FK → Workstream. `ON DELETE CASCADE`.                                                                    |
| `position`     | `integer`      | 1-indexed, contiguous. See unique constraint below.                                                      |
| `name`         | `varchar(255)` |                                                                                                          |
| `deadline`     | `date`         | Nullable. Calendar day.                                                                                  |
| `ownerId`      | `uuid`         | Nullable. FK → User. `ON DELETE SET NULL`. Inherits from Workstream.defaultOwnerId at read time if null. |
| `outcome`      | `step_outcome` | Nullable. Enum: `done` / `skipped`. Null while not yet passed.                                           |
| `outcomeAt`    | `timestamptz`  | Nullable. Auto-recorded when `advance()` records the outcome.                                            |
| `blocked`      | `boolean`      | Default `false`. Meaningful only on the current step. Not auto-cleared on advance (historical record).   |
| `createdAt`    | `timestamptz`  | `defaultRaw: now()`                                                                                      |
| `updatedAt`    | `timestamptz`  | `defaultRaw: now()`                                                                                      |

**Unique constraint:**
`UNIQUE (workstream_id, position) DEFERRABLE INITIALLY DEFERRED`

Renumber the tail (all positions ≥ target) in one transaction on
insert/reorder/delete. The deferred constraint allows bulk position updates
within the transaction.

**Cascades:** `ON DELETE CASCADE` → ChecklistItem, Note.

**Indexes:** `step.workstream_id` (FK index, created by the FK).

---

### ChecklistItem

Sub-item within a Step. Lightweight: name + done toggle. Progress is
informational — does not gate advancing (Decision 31).

| Column      | Type           | Constraints / Notes                          |
| ----------- | -------------- | -------------------------------------------- |
| `id`        | `uuid`         | PK, `defaultRaw: gen_random_uuid()`          |
| `stepId`    | `uuid`         | FK → Step. `ON DELETE CASCADE`.              |
| `position`  | `integer`      | 1-indexed, contiguous. Same pattern as Step. |
| `name`      | `varchar(255)` |                                              |
| `done`      | `boolean`      | Default `false`.                             |
| `createdAt` | `timestamptz`  | `defaultRaw: now()`                          |
| `updatedAt` | `timestamptz`  | `defaultRaw: now()`                          |

**Unique constraint:**
`UNIQUE (step_id, position) DEFERRABLE INITIALLY DEFERRED`

**Indexes:** Explicit index on `checklist_item.step_id`.

---

### Note

A text entry in a Step's log. Author-editable/deletable (Decision 39). URLs in
content render as clickable links in the UI (Decision 40).

| Column      | Type          | Constraints / Notes                         |
| ----------- | ------------- | ------------------------------------------- |
| `id`        | `uuid`        | PK, `defaultRaw: gen_random_uuid()`         |
| `stepId`    | `uuid`        | FK → Step. `ON DELETE CASCADE`.             |
| `authorId`  | `uuid`        | Nullable. FK → User. `ON DELETE SET NULL`.  |
| `content`   | `text`        | Max length validated in input DTO (not DB). |
| `createdAt` | `timestamptz` | `defaultRaw: now()`                         |
| `updatedAt` | `timestamptz` | `defaultRaw: now()`                         |

**Indexes:** Explicit index on `note.step_id`.

---

## Cascade summary

| Parent → Child                    | On Delete |
| --------------------------------- | --------- |
| Project → Workstream              | CASCADE   |
| Project → Group                   | CASCADE   |
| Workstream → Step                 | CASCADE   |
| Step → ChecklistItem              | CASCADE   |
| Step → Note                       | CASCADE   |
| Group → Workstream                | SET NULL  |
| User → Workstream (owner)         | SET NULL  |
| User → Step (owner)               | SET NULL  |
| User → Note (author)              | SET NULL  |
| Workstream → Step (currentStepId) | RESTRICT  |

---

## Explicit indexes (beyond PK / unique / FK)

| Table            | Column(s) | Rationale                         |
| ---------------- | --------- | --------------------------------- |
| `note`           | `step_id` | Load notes for a step detail view |
| `checklist_item` | `step_id` | Load checklist for a step detail  |

No other indexes needed at this data volume (20–50 workstreams × ~10 steps).

---

## Module layout

One NestJS module — `workstream` — owns the entire aggregate:

```
src/modules/workstream/
  workstream.module.ts
  workstream.controller.ts        ← Workstream CRUD + start/advance
  step.controller.ts              ← Step CRUD (scoped to workstream)
  note.controller.ts              ← Note CRUD (scoped to step)
  checklist-item.controller.ts    ← ChecklistItem CRUD (scoped to step)
  workstream.service.ts           ← Workstream CRUD + pipeline transitions (start/advance/state)
  step.service.ts                 ← Step CRUD (future-only mutation, position management)
  note.service.ts                 ← Note CRUD
  checklist-item.service.ts       ← ChecklistItem CRUD
  dtos/
    input/                        ← Create/Update DTOs (class-validator)
    output/                       ← Response DTOs (@ApiProperty)
```

**Boundary rules:**

- Sub-entity services are internal to the module (not exported).
- `workstream.service` is the single authority for pipeline transitions
  (ADR 0005). Nothing outside this module writes `startedAt`, `completedAt`,
  `currentStepId`, or Step `outcome`/`outcomeAt`.
- Controllers call the matching service directly.
- No new ADR needed — ADR 0005 covers the "one authoritative module" decision.

**Other modules** (registered separately, not inside workstream):

- `project` — Project CRUD. Thin module.
- `group` — Group CRUD. Thin module.
- `user` — User upsert-on-login, lookup. Thin module.

---

## Relationship diagram

```
Project ──1:N──→ Workstream ──1:N──→ Step ──1:N──→ ChecklistItem
    │                │                  │
    │                │                  └──1:N──→ Note
    │                │
    └──1:N──→ Group ←──N:1── Workstream (optional)

User ←── Workstream.defaultOwnerId (optional)
User ←── Step.ownerId (optional, inherits if null)
User ←── Note.authorId
User ←── Workstream.currentStepId → Step (optional, circular)
```

---

## Notes on implementation

- **Owner inheritance** is read-time: if `step.ownerId` is null, the UI/API
  response fills it from `workstream.defaultOwnerId`. No DB-level default.
- **Step status** is derived from pointer position (ADR 0005), never stored.
- **Workstream lifecycle** is derived from `(startedAt, completedAt)`, never
  stored as an enum.
- **`currentStepId` circular FK**: Create Workstream first (currentStepId null),
  create Steps, then set currentStepId on `start()`. MikroORM handles this via
  `flush()` ordering or explicit `em.flush()` calls.
- **Icon representation** (Decision 25): stored as `varchar`. Whether the value
  is an emoji character or a named icon is a UI decision — the schema supports
  both.
