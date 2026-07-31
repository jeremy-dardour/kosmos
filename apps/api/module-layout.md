# Module Layout

NestJS module structure for V1. Follows the entity/schema design in
[entity-schema-design.md](../../docs/entity-schema-design.md) and the pipeline
state machine in
[ADR 0005](../../docs/adr/0005-workstream-pipeline-state-machine.md).

---

## One module for the project aggregate

A single `project` module owns Project, Group, Workstream, Step, ChecklistItem
and Note:

```
src/modules/project/
  project.module.ts
  project.controller.ts           ← Project CRUD
  project.service.ts
  overview.controller.ts          ← GET /projects/:projectId/overview
  overview.service.ts             ← the aggregate read model
  group.controller.ts             ← Group CRUD
  group.service.ts
  workstream.controller.ts        ← Workstream CRUD + advance
  workstream.service.ts           ← CRUD + pipeline transitions (start/advance)
  repositories/
    project.repository.ts         ← Project entity persistence
    group.repository.ts           ← Group entity persistence
    workstream.repository.ts      ← Workstream aggregate persistence
    overview.repository.ts        ← Consistent overview entity graph
  note.controller.ts              ← Note CRUD (scoped to step)
  note.service.ts
  checklist-item.controller.ts    ← immediate done/undone toggle
  checklist-item.service.ts
  utils/                          ← cross-entity domain functions
  dtos/
    input/                        ← Create/Update DTOs (class-validator)
    output/                       ← Response DTOs (@ApiProperty)
```

**Why one module.** These six entities are one aggregate in practice. The
overview read model has to see across all of them at once, and the pipeline
state machine needs Workstream and Step together. Splitting them into separate
NestJS modules puts them on opposite sides of the ESLint `boundaries` rule
(feature modules may not import each other), which would force either
cross-module service injection or contract DTOs pushed out into `shared/` —
boundaries to argue with, for no isolation worth having at this scale (one
project, 20–50 workstreams).

**Boundary rules inside the module:**

- `workstream.service` is the single authority for pipeline transitions
  and atomic pipeline replacement (ADR 0005). Nothing else writes `startedAt`,
  `completedAt`, `currentStepId`, or a Step's `outcome` / `outcomeAt`.
- Repositories are the only classes that use the EntityManager or other
  MikroORM persistence APIs. They accept and return entities, not DTOs.
- Services instantiate and mutate entities from input DTOs. Services or
  controllers map entities to output DTOs through the canonical DTO mappers.
- Aggregate responses reuse canonical entity DTOs unless a projection is
  materially different. The overview envelope composes `WorkstreamDto` and
  `StepDto`; it does not create parallel entity shapes for a few extra fields.
- Entity-owned derived state (lifecycle, step status, nearest deadline) lives on
  the entity. Cross-entity owner resolution remains a pure function in
  `utils/`.
- The overview read model has its own query-focused repository so its
  repeatable-read entity graph is not forced through CRUD repositories.
- Controllers stay thin and call the matching service directly.

---

## Other modules

- `user` — user entity registration. Authentication provisioning and project
  ownership lookups share the entity-only `database/repositories/user.repository.ts`.

---

## History

Earlier drafts of this document split `project`, `group`, `workstream` and
`user` into four modules. That was reversed during slice 1 (#18) in favour of
the single-module layout the
[API contract PRD](../../docs/specs/v1-product/api-contract.md#module-structure) had
specified;
the `user` module was kept.
