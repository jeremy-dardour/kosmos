<!-- wayfinder:grilling -->

# Concrete data model & MikroORM schema

Type: grilling
Status: done

## Question

Translate [CONTEXT.md](../../../CONTEXT.md) + [ADR 0005](../../adr/0005-workstream-pipeline-state-machine.md)
into a concrete MikroORM 7 entity design (following [apps/api/STANDARDS.md](../../../apps/api/STANDARDS.md)),
ready for the API-contract ticket. Resolve the choices the domain spec left open:

- **Step ordering** — integer `position` with renumber-the-tail on reorder (ADR
  0005); uniqueness per Workstream, gap handling, and how "only future steps
  reorder" is enforced.
- **Checklist sub-items** — their own entity vs. embedded/JSON on the Step
  (Decision 30: derived, lightweight name + done/skipped).
- **Pipeline state fields** — `currentStepId`, `startedAt`, `completedAt` on
  Workstream; per-Step `outcome`/`outcomeAt`/`blocked`. Which are columns vs.
  derived-in-code; how the core invariant (`currentStepId` non-null ⟺ Active) is
  guarded.
- **Entities & relations** — Project (name + optional `eventDate`), Group
  (nullable, single per Workstream), User (created on first login), Note (author
  - timestamps, editable). Nullability per the standards (TS-driven).
- **Cascades & indexes** — delete Workstream → Steps/Notes; delete Project → all;
  indexes for the single overview read.
- **Module boundary** — where the invariant-enforcing Workstream domain module
  (`start`/`advance`/`state`, ADR 0005) sits relative to the entities.

Output: an agreed entity/schema design (not necessarily code). Consider whether
the "one authoritative Workstream module" warrants its own ADR.

## Output

[docs/entity-schema-design.md](../../../entity-schema-design.md) — the full
schema spec (entities, columns, constraints, cascades, indexes, module layout).
All 16 design questions resolved in
[session 06](../../sessions/session-06-2026-07-19-schema-grilling.md#decisions).
ADR 0005 was deemed sufficient — no new ADR for the module shape.
