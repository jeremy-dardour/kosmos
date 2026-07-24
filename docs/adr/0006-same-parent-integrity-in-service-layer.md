# ADR 0006: Same-parent integrity enforced in the service layer

**Status:** Accepted — 2026-07

## Decision

Two cross-entity constraints are enforced in `WorkstreamService`, not as
database foreign keys:

1. **Workstream.group** must belong to the same Project as the Workstream.
2. **Workstream.currentStep** must belong to that Workstream.

Simple single-column FKs (`group_id → group.id`, `current_step_id → step.id`)
remain for referential integrity and cascade/restrict behavior. The same-parent
checks are guards at the top of the relevant service methods.

## Why not composite FKs

The natural DB-level solution is a composite FK that includes the shared parent
column — e.g. `(project_id, group_id) → Group(project_id, id)`. This was
attempted and failed:

- MikroORM 7's `TsMorphMetadataProvider` does not resolve `columnTypes` for
  composite FK join columns that reference non-PK unique constraints. The
  schema generator crashes with `TypeError: Cannot read properties of undefined
(reading 'toLowerCase')` in `extractSimpleType`.
- The `joinColumns`/`ownColumns`/`referencedColumnNames` options exist in
  MikroORM's type definitions but are undocumented for `@ManyToOne`. The
  [composite keys docs](https://mikro-orm.io/docs/composite-keys) only cover
  composite primary keys, not composite FKs targeting unique constraints.
- Supporting unique constraints (`UNIQUE(project_id, id)` on Group,
  `UNIQUE(workstream_id, id)` on Step) are required as FK targets but add
  schema noise for constraints that are redundant with the PK.

## Trade-offs

- **Lost:** DB-level guarantee that the referenced entity shares the same
  parent. A direct SQL `UPDATE` bypassing the ORM could create an inconsistent
  reference.
- **Gained:** Working migration pipeline, simpler entity definitions, no
  undocumented ORM features.
- **Acceptable because:** 2–6 users, all writes go through the service layer,
  no direct DB access in production. If MikroORM adds documented support for
  composite FKs on unique constraints in a future version, this can be
  revisited.
