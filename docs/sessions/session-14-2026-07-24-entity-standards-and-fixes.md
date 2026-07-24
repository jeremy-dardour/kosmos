# Session 14 — Entity standards & fixes (2026-07-24)

## What was done

- Audited all 7 MikroORM entity definitions against the
  [entity-schema-design doc](../entity-schema-design.md) and
  [API standards](../../apps/api/STANDARDS.md).
- Created [ENTITIES_STANDARDS.md](../../apps/api/ENTITIES_STANDARDS.md) — the
  full entity conventions reference: decorator imports, TsMorph explicit vs
  inferred rules, property modifiers, timestamps, relationships (simple,
  circular), enums, unique constraints, and indexes.
- Moved entity-specific content out of `apps/api/STANDARDS.md` into the new
  file; STANDARDS.md now links to it.
- Added `.claude/rules/entities.md` — path-scoped rule that loads
  ENTITIES_STANDARDS.md when touching `*.entity.ts` files in the API.
- Fixed entity reference pattern: ManyToOne (owning side) uses value imports
  with `() => ClassName`. OneToMany and circular ManyToOne use type-only
  imports with `() => 'ClassName' as any` — string entity names resolved by
  MikroORM's registry at runtime, `as any` bypasses the overly strict legacy
  decorator types. This resolves all type errors while avoiding SWC's TDZ
  error on circular value imports.
- Added `onUpdate: () => new Date()` to `updatedAt` on all 7 entities so
  MikroORM auto-updates the timestamp on every flush.
- Updated [entity-schema-design doc](../entity-schema-design.md) with the
  `updatedAt` onUpdate mechanism.
- Removed composite FKs from Workstream (`group` and `currentStep`) — MikroORM
  7's metadata pipeline does not resolve `columnTypes` for composite FKs
  targeting non-PK unique constraints, crashing the schema generator. Reverted
  to simple single-column FKs per the original schema doc. Same-parent
  integrity will be enforced in `WorkstreamService`.
- Wrote [ADR 0006](../adr/0006-same-parent-integrity-in-service-layer.md) —
  documents why composite FKs failed and the service-layer alternative.

## Decisions

- **Composite FKs dropped, service-layer guards instead**: MikroORM 7's
  `TsMorphMetadataProvider` does not resolve `columnTypes` for composite FKs
  targeting non-PK unique constraints — schema generator crashes. Same-parent
  integrity moves to `WorkstreamService`. See
  [ADR 0006](../adr/0006-same-parent-integrity-in-service-layer.md).
- **`updatedAt` via MikroORM `onUpdate`**: No DB trigger needed —
  `onUpdate: () => new Date()` on the `@Property` decorator handles it at the
  ORM level during flush.
- **Circular references via type-only imports + string names**: SWC's live
  bindings cause TDZ errors with circular value imports (unlike tsc's `var`
  compilation). The owning side (ManyToOne) keeps the value import; the
  inverse side uses type-only import + `() => 'ClassName' as any`.
  Documented in ENTITIES_STANDARDS.

## Learnings / tensions surfaced

- MikroORM 7 legacy decorators type `@ManyToOne(string)` as `never` — the
  string-from-callback pattern (`() => 'ClassName'`) that worked in earlier
  versions is a type error in v7. Runtime still supports it; `as any` is the
  narrowest workaround.
- SWC compiles imports as live bindings with `let`/`const` (unlike tsc's `var`
  compilation). Circular value imports cause TDZ errors at module load time,
  even when the class reference is only used inside a lazy callback. The
  initial attempt to use value imports everywhere failed at migration
  generation.
- `onUpdate` is an ORM-level hook (runs during `em.flush()`), not a DB-level
  mechanism. PostgreSQL `DEFAULT` only applies on INSERT; auto-update on
  modification requires either MikroORM's `onUpdate`, a `@BeforeUpdate` hook,
  or a DB trigger.

## Status at end of session

Entity definitions are type-clean and documented. All type errors resolved,
`onUpdate` added to timestamps, composite FKs removed in favor of service-layer
guards (ADR 0006). Schema generator no longer crashes. PR #28 review fix-up can
continue with migration regeneration next.
