# Session 13 — Claude Rules, Entity Standards, Parallel Ports (2026-07-24)

## What was done

### Path-scoped Claude rules

- Added `.claude/rules/api.md` and `.claude/rules/web.md` using Claude Code's
  path-scoped rules mechanism (`paths` frontmatter + `@import`) so
  `apps/api/{README,STANDARDS}.md` and `apps/web/{README,STANDARDS}.md` load
  into context automatically when Claude reads a file under the matching app
  directory.
- Initially attempted via a PreToolUse hook; redirected to Claude Code's native
  `.claude/rules/` feature instead — no hook needed.
- Replicated the same two rule files into the sibling template repo
  (`~/Projects/Perso/typescript-fullstack-template`), committed there
  (`improve-config` branch, commits `32759f2`, `4aea1b6`).
- Added `.claude/rules/entities.md` — loads ENTITIES_STANDARDS.md when
  touching `*.entity.ts` files.

### Entity standards & fixes

- Audited all 7 MikroORM entity definitions against the
  [entity-schema-design doc](../entity-schema-design.md) and
  [API standards](../../apps/api/STANDARDS.md).
- Created [ENTITIES_STANDARDS.md](../../apps/api/ENTITIES_STANDARDS.md) — the
  full entity conventions reference: decorator imports, TsMorph explicit vs
  inferred rules, property modifiers, timestamps, relationships (simple,
  circular), enums, unique constraints, and indexes.
- Moved entity-specific content out of `apps/api/STANDARDS.md` into the new
  file; STANDARDS.md now links to it.
- Fixed entity reference pattern: ManyToOne (owning side) uses value imports
  with `() => ClassName`. OneToMany and circular ManyToOne use type-only
  imports with `() => 'ClassName' as any` + eslint-disable comments — string
  entity names resolved by MikroORM's registry at runtime.
- Added `onUpdate: () => new Date()` to `updatedAt` on all 7 entities.
- Updated [entity-schema-design doc](../entity-schema-design.md) with the
  `updatedAt` onUpdate mechanism.
- Removed composite FKs from Workstream (`group` and `currentStep`) — MikroORM
  7's metadata pipeline does not resolve `columnTypes` for composite FKs
  targeting non-PK unique constraints, crashing the schema generator. Reverted
  to simple single-column FKs. Same-parent integrity enforced in service layer.
- Wrote [ADR 0006](../adr/0006-same-parent-integrity-in-service-layer.md).

### Parallel workspace ports

- Diagnosed why the API couldn't reach Postgres locally: commit `9691f9e`
  removed `ports:` entirely from `docker-compose.yml`, not just
  `container_name`.
- Restored host ports via env-var interpolation: `${DATABASE_PORT:-5432}` /
  `${DATABASE_TEST_PORT:-5433}`.
- Added root `.env.example` for port vars, `WEB_PORT` var + `vite.config.ts`
  support, and comments in `apps/api/.env.example`.
- Added `scripts/setup_parallel_workspace.sh`: picks 4 random free ports
  (Postgres, Postgres-test, API, web), copies `.env.example` -> `.env`,
  substitutes ports.
- E2E test database handled separately: `.env.e2e` is a tracked fixture;
  script writes an untracked `apps/api/.env.e2e.local` loaded after `.env.e2e`
  with `override: true`.
- Documented in root README and `apps/api/README.md`.

### Lint cleanup

- Deleted dead template items files (`use-items.ts`, `items-page.tsx`,
  `item-form-dialog.tsx`) — the API endpoints they referenced were removed
  with the example entities. Updated `router.tsx` with a placeholder.
- Added eslint-disable comments on all `as any` circular-reference lines
  across 4 entity files (7 lines total).
- Verified migration matches `schema:update --dump` output exactly.

## Decisions

- **Path-scoped rules over hooks**: matches Claude Code's intended mechanism,
  no shell scripting needed.
- **Composite FKs dropped, service-layer guards instead**: MikroORM 7's
  `TsMorphMetadataProvider` does not resolve `columnTypes` for composite FKs
  targeting non-PK unique constraints. See
  [ADR 0006](../adr/0006-same-parent-integrity-in-service-layer.md).
- **`updatedAt` via MikroORM `onUpdate`**: No DB trigger needed —
  `onUpdate: () => new Date()` handles it at the ORM level during flush.
- **Circular references via type-only imports + string names**: SWC's live
  bindings cause TDZ errors with circular value imports. Owning side keeps
  value import; inverse side uses type-only import + `() => 'ClassName' as any`
  with eslint-disable. Documented in ENTITIES_STANDARDS.
- **Configurable ports, not no-published-port pattern**: the Docker pattern
  of dropping `ports:` only works when the caller is itself a container.
  Default dev flow runs the API as a host process.
- **`.env.e2e.local` override instead of editing tracked fixture**: keeps
  `.env.e2e` stable for CI; per-workspace port in a gitignored file.

## Learnings / tensions surfaced

- Claude Code's `.claude/rules/*.md` supports YAML frontmatter `paths: [...]`
  glob patterns and `@path/to/file` import syntax — rules trigger when Claude
  reads a matching file.
- MikroORM 7 legacy decorators type `@ManyToOne(string)` as `never` — the
  string-from-callback pattern is a type error in v7. Runtime still supports
  it; `as any` + eslint-disable is the narrowest workaround.
- SWC compiles imports as live bindings with `let`/`const` (unlike tsc's `var`).
  Circular value imports cause TDZ errors at module load time, even inside
  lazy callbacks.
- `onUpdate` is ORM-level (runs during `em.flush()`), not DB-level. PostgreSQL
  `DEFAULT` only applies on INSERT.
- Docker's host port publishing is a single shared namespace — `-p <project>`
  isolates container names, volumes, and networks, but **not** published host
  ports.
- `dotenv.config()` does not override already-set `process.env` vars unless
  `override: true` — this is what makes the `.env.e2e` -> `.env.e2e.local`
  layering safe.
- MikroORM's `deferMode: 'deferred'` on `@Unique` constraints does not produce
  `DEFERRABLE INITIALLY DEFERRED` in the generated SQL — may not be supported
  for unique constraints. Service layer will need to handle constraint ordering
  for bulk reorder operations.

## Status at end of session

Entity definitions are type-clean, lint-clean, and documented. Migration
verified against `schema:update --dump`. Dead template items files removed.
Parallel workspace ports working. PR #28 review fix-up can continue with
migration regeneration next.
