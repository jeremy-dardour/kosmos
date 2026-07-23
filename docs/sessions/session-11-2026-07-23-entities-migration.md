# Session 11 — Entities + Initial Migration (2026-07-23)

## What was done

- **Reviewed the 10 open build issues** (#17–#26), mapped their dependency
  chain, and confirmed #17 (Entities + initial migration) as the starting
  point.
- **Defined all 7 MikroORM entities:** User, Project, Group, Workstream, Step,
  ChecklistItem, Note — following the
  [entity schema design](../entity-schema-design.md) and
  [API STANDARDS](../../apps/api/STANDARDS.md) (TsMorph, legacy decorators,
  TS-driven nullability).
- **Generated the initial Postgres migration** with correct FK cascades,
  `step_outcome` enum, deferred unique constraints on position columns, and
  explicit indexes on `note.step_id` / `checklist_item.step_id`.
- **Registered entities in 4 NestJS modules** (user, project, group,
  workstream) per the [module layout](../module-layout.md).
- **Removed the scaffolding Item entity**, its module, factory, seeder
  reference, and E2E test.
- **Verified migration runs cleanly** against a fresh Postgres — all tables,
  enum, constraints, and deferred unique confirmed via `pg_constraint`.
- **Opened PR #28** targeting main.

## Decisions

- **Circular-dep pattern for MikroORM entities:** ManyToOne (owning side) uses
  value `import` + `() => EntityClass` arrow function. OneToMany/OneToOne
  (inverse/circular side) uses `import type` + deferred `require()` inside the
  entity arrow function, with eslint-disable for the three required rules.
  This is the only pattern that satisfies MikroORM's metadata resolution, SWC
  CJS transpilation, and the project's strict TypeScript/ESLint config.
- **Added `discovery.tsConfigPath`** to the MikroORM CLI config
  (`mikro-orm.cli.config.ts`) pointing to `tsconfig.mikro-cli.json`. The
  default `tsconfig.json` is a solution-style config with `files: []` — TsMorph
  gets zero source files and can't resolve entity types.

## Learnings / tensions surfaced

- **TsMorph + MikroORM type inference doesn't work for relationships in this
  setup.** Even with the correct tsconfig, `extractType()` captures
  `prop.type` from reflect-metadata _before_ TsMorph runs, then overwrites the
  TsMorph result. This means ALL relationship decorators need explicit `entity`
  arrow functions — TsMorph inference only works for scalar properties.
- **CJS circular deps with SWC are strict:** SWC emits class exports via
  `Object.defineProperty` with TDZ-protected getters. Any transitive circular
  import chain (e.g., Note → Step → Workstream → Step) triggers
  `ReferenceError: Cannot access 'X' before initialization` at module load
  time. The `require()` inside arrow functions defers resolution past module
  load.

## Status at end of session

Issue #17 is complete — all entities defined, migration verified, PR #28 open.
Next issue is **#18 — Layout shell + overview data + card list** (first visual
result: backend overview endpoint + frontend two-panel layout with grouped
workstream cards).
