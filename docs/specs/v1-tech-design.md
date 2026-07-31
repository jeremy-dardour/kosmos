# V1 Technical Design

How V1 is built. Links the decisions made across schema, API, state machine,
auth, and deployment into one implementation reference.

For **what** V1 does and **why**, see the
[V1 Product PRD](./v1-product/PRD.md). For the domain glossary, see
[CONTEXT.md](../../CONTEXT.md).

---

## Architecture

### Monorepo structure

```
apps/
  api/          → NestJS REST API (MikroORM 7 + Postgres)
  web/          → React SPA (Vite + openapi-react-query)
packages/
  api-contracts/  → OpenAPI-generated TypeScript types
  eslint-config/  → Shared ESLint flat config
  shared/         → Shared utilities
  typescript-config/ → Shared tsconfig presets
```

### Single deployable

One Docker container serves both the API and the Vite-built SPA
(`ServeStaticModule`). One origin, no CORS, one deploy target.

### Module layout

```
src/modules/
  project/                 ← owns the entire aggregate
    project.module.ts
    project.controller.ts       (Project CRUD)
    project.service.ts
    overview.controller.ts      (the aggregate read model)
    overview.service.ts
    group.controller.ts         (Group CRUD)
    group.service.ts
    workstream.controller.ts    (Workstream CRUD + advance + pipeline edit)
    workstream.service.ts       (pipeline transitions/editing + CRUD)
    note.controller.ts
    note.service.ts             (author-guarded edit/delete)
    checklist-item.controller.ts (immediate done/undone toggle)
    checklist-item.service.ts
    utils/                      (pure derivation functions)
    dtos/
      input/                    (class-validator)
      output/                   (@ApiProperty)
  user/                    ← upsert-on-login, read-only endpoints
```

Full layout rationale: [API module layout](../../apps/api/module-layout.md).

---

## Data model

Seven entities, one Postgres enum. Full column specs, constraints, cascades, and
indexes in [entity-schema-design.md](../entity-schema-design.md).

```
Project ──1:N──→ Workstream ──1:N──→ Step ──1:N──→ ChecklistItem
    │                │                  │
    │                │                  └──1:N──→ Note
    │                │
    └──1:N──→ Group ←──N:1── Workstream (optional)

User ←── Workstream.ownerId (optional)
User ←── Step.ownerId (optional, inherits if null)
User ←── Note.authorId
Workstream.currentStepId ──→ Step (nullable circular FK, RESTRICT)
```

**Key schema decisions:**

- **Step positions:** 1-indexed integers with `UNIQUE (workstream_id, position)
DEFERRABLE INITIALLY DEFERRED` — allows bulk position reassignment within a
  transaction.
- **Circular FK (`currentStepId`):** `ON DELETE RESTRICT` prevents deleting the
  current step. Mutations are UPDATEs, not DELETEs — no flush-ordering concern.
- **No stored status enums:** Workstream lifecycle is derived from
  `(startedAt, completedAt)`. Step status is derived from position vs pointer.
  See [ADR 0005](../adr/0005-workstream-pipeline-state-machine.md).
- **Cascades:** Project → Workstream/Group (CASCADE), Workstream → Step
  (CASCADE), Step → ChecklistItem/Note (CASCADE), Group/User → SET NULL on
  optional FKs.
- **Same-parent integrity (service-layer):** Two constraints that can't be
  expressed as simple FKs without composite keys (unsupported by MikroORM's
  metadata pipeline): (1) `Workstream.groupId` must reference a Group in the
  same Project, (2) `Workstream.currentStepId` must reference a Step belonging
  to that Workstream. Both are enforced as guards in `WorkstreamService`.

---

## State machine

The pipeline state machine is the core of the domain. Full specification in
[ADR 0005](../adr/0005-workstream-pipeline-state-machine.md). Implementation
implementation decisions resolved in session 10.

### Lifecycle (derived, never stored)

| `startedAt` | `completedAt` | `currentStepId` | Lifecycle      |
| :---------: | :-----------: | :-------------: | -------------- |
|    null     |     null      |      null       | **NotStarted** |
|     set     |     null      |       set       | **Active**     |
|     set     |      set      |      null       | **Complete**   |

### Transitions

One API endpoint: `POST /workstreams/:id/advance`. The server dispatches by
lifecycle:

| Current state           | Behavior                                            | Outcome param                |
| ----------------------- | --------------------------------------------------- | ---------------------------- |
| NotStarted              | Sets `startedAt`, points to first step              | Must not be provided (400)   |
| Active                  | Records outcome on current step, moves pointer      | Optional, defaults to `done` |
| Active (last step)      | Records outcome, sets `completedAt`, clears pointer | Optional, defaults to `done` |
| Complete                | 409 `workstream-not-advanceable`                    | —                            |
| NotStarted + zero steps | 409 `workstream-empty`                              | —                            |

Internally, `WorkstreamService` owns the lifecycle dispatch and transition
decisions behind the unified API surface.

### Implementation decisions

- **Service structure:** All pipeline logic as private methods on
  `WorkstreamService`. No separate state-machine class.
- **Derived state:** Entity behavior derives lifecycle, step status and nearest
  deadline; cross-entity owner resolution remains a pure domain function.
- **Persistence:** Repositories alone use MikroORM. Advance and reorder run
  through repository operations that own their transaction and any required
  row locking while accepting and returning entities, never DTOs.
- **Validation:** Guards at the top of service methods. Wrong lifecycle → 409.
  Outcome on NotStarted → 400 (DTO validation).

---

## API contract

Full endpoint spec, DTOs, and error codes in the
[V1 API contract](./v1-product/api-contract.md).

### Design principles

1. **One overview call** — `GET /projects/:id/overview` returns the full tree
   (project + groups + workstreams + steps + checklist items + users). At 20–50
   workstreams this is a few KB.
2. **Named RPC for pipeline action** — `POST /workstreams/:id/advance`. Not
   PATCH — the pointer logic is too specific for a generic field update.
3. **Derived state in responses** — lifecycle, step status, owner inheritance,
   nearest deadline — all computed server-side.
4. **Atomic pipeline editing** — a Workstream-level command replaces its
   current/future editable tail in one transaction. Notes remain flat CRUD;
   checklist toggles have a focused immediate endpoint.
5. **No pagination** — client-side filters at this data volume.
6. **Canonical entity DTOs** — aggregate reads compose the normal Project,
   Group, Workstream and Step DTOs. A read-model-specific entity shape is
   introduced only when the representation is materially different.

### Step mutability

| Zone    | Structure (add/delete/reorder) | Attributes (name, deadline, owner, blocked) |    Notes    |
| ------- | :----------------------------: | :-----------------------------------------: | :---------: |
| Past    |             Frozen             |                   Frozen                    | Append only |
| Current |             Frozen             |                  Editable                   |     Yes     |
| Future  |            Editable            |                  Editable                   |     Yes     |

Enforcement: the Workstream pipeline command locks the aggregate, compares each
submitted Step with the pointer, and commits the complete editable tail or
nothing. Violations → 409 `step-frozen`, `step-not-deletable`,
`pipeline-mismatch`, or `pipeline-stale`.

### Error responses

| Status | When                                    | Type slug                    |
| ------ | --------------------------------------- | ---------------------------- |
| 409    | `advance` on Complete                   | `workstream-not-advanceable` |
| 409    | `advance` on empty workstream           | `workstream-empty`           |
| 400    | `advance` with outcome on NotStarted    | validation error             |
| 409    | Mutation on past step                   | `step-frozen`                |
| 409    | Structural mutation on current step     | `step-not-deletable`         |
| 409    | Submitted editable tail is inconsistent | `pipeline-mismatch`          |
| 409    | Pipeline changed since editing began    | `pipeline-stale`             |
| 403    | Edit/delete note by non-author          | `not-note-author`            |

---

## Auth

Authentication architecture, contracts, implementation decisions, and
rationale are documented in
[ADR 0007](../adr/0007-web-auth-module-boundaries.md).

---

## Deployment

Hosting research in [hosting-deploy.md](../research/hosting-deploy.md).

| Concern    | Decision                                                                          |
| ---------- | --------------------------------------------------------------------------------- |
| App host   | Google Cloud Run (scale-to-zero, free tier)                                       |
| Database   | Neon (managed Postgres, free tier, connection pooling)                            |
| Frontend   | Single deployable — SPA served from same container                                |
| CD         | GitHub Actions → GHCR → `gcloud run deploy`                                       |
| Migrations | At container start ([ADR 0001](../adr/0001-migrations-run-on-container-start.md)) |
| Secrets    | Cloud Run env vars / Secret Manager                                               |
| TLS        | Cloud Run automatic HTTPS + custom domain                                         |
| Cost       | ~$0/mo steady state                                                               |

---

## Build sequence

11 GitHub issues. End-to-end slices — each produces a visible, testable result
(backend + frontend together). Auth and deployment are independent technical
tracks.

### End-to-end slices (sequential)

| #   | Issue                                                                                                | Scope                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0   | [#17 — Entities + migration](https://github.com/jeremy-dardour/wedding-planner/issues/17)            | All MikroORM entities, initial migration (foundation)                                                   |
| 1   | [#18 — Layout shell + overview + cards](https://github.com/jeremy-dardour/wedding-planner/issues/18) | Overview endpoint + two-panel layout + grouped cards with pipeline dots + UI foundation (design tokens) |
| 2   | [#19 — Detail slide-over (read-only)](https://github.com/jeremy-dardour/wedding-planner/issues/19)   | Notes read endpoint + detail panel with step pipeline, checklist, notes                                 |
| 3   | [#20 — Advance + start](https://github.com/jeremy-dardour/wedding-planner/issues/20)                 | Unified advance endpoint + card buttons + blocked resolve                                               |
| 4   | [#21 — Deadline badges + filters](https://github.com/jeremy-dardour/wedding-planner/issues/21)       | Countdown badges, urgency thresholds, owner/group filter dropdowns (frontend only)                      |
| 5   | [#22 — Notes write actions](https://github.com/jeremy-dardour/wedding-planner/issues/22)             | Note CRUD endpoints (author-guarded) + add/edit/delete in detail panel                                  |
| 6   | [#23 — Checklist + step edits](https://github.com/jeremy-dardour/wedding-planner/issues/23)          | Step + checklist CRUD endpoints + mutability enforcement + toggles + inline editing                     |
| 7   | [#24 — Workstream + group management](https://github.com/jeremy-dardour/wedding-planner/issues/24)   | Create/edit/delete workstreams and groups from UI                                                       |

### Technical (independent)

| #   | Issue                                                                                                        | Scope                                                         | Blocking?                  |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- | -------------------------- |
| 8   | [#25 — Auth: Google OAuth](https://github.com/jeremy-dardour/wedding-planner/issues/25)                      | GIS wiring, allow-list, user upsert                           | Required before production |
| 9   | [#30 — Auth: backend-validated session restore](https://github.com/jeremy-dardour/wedding-planner/issues/30) | `/api/users/me`, local ID-token restore, explicit auth states | Required before production |
| 10  | [#26 — Deployment: Cloud Run + Neon](https://github.com/jeremy-dardour/wedding-planner/issues/26)            | Infra, CD pipeline, custom domain                             | Non-blocking               |

### Dependency graph

```
#17 → #18 → #19 → #22 (notes write)
        │      └──→ #23 (checklist + step edits)
        ├──→ #20 (advance)
        ├──→ #21 (badges + filters)
        └──→ #24 (workstream management)

#25 → #30 (independent — FakeAuth covers dev)
#26 (independent — can land anytime)
```

---

## Open decisions (deferred to implementation)

- **Workstream icon representation** — emoji string vs named icon set. The
  `icon` field is `varchar(255)` and accepts either. Visual refinement during
  UI slices.
- **i18n language** — English-first (`en` primary, `fr` secondary). Template
  has i18n wired; translation is a polish pass, not a blocker.

---

## ADR index

| ADR                                                      | Decision                                      |
| -------------------------------------------------------- | --------------------------------------------- |
| [0001](../adr/0001-migrations-run-on-container-start.md) | Migrations run at container start             |
| [0002](../adr/0002-dual-validation-stack.md)             | Dual validation stack (zod + class-validator) |
| [0003](../adr/0003-trust-proxy.md)                       | Trust proxy                                   |
| [0004](../adr/0004-eslint-layered-flat-configs.md)       | ESLint layered flat configs                   |
| [0005](../adr/0005-workstream-pipeline-state-machine.md) | Workstream pipeline state machine             |
