# Module Layout

NestJS module structure for V1. Follows the entity/schema design in
[entity-schema-design.md](./entity-schema-design.md) and the pipeline state
machine in [ADR 0005](./adr/0005-workstream-pipeline-state-machine.md).

---

## Workstream module

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

---

## Other modules

Registered separately, not inside workstream:

- `project` — Project CRUD. Thin module.
- `group` — Group CRUD. Thin module.
- `user` — User upsert-on-login, lookup. Thin module.
