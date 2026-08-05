# Standards: API

Inherits: [Global standards](../../STANDARDS.md)

## Module structure

See [module-layout.md](./module-layout.md) for the project aggregate layout and
its rationale.

```
src/
  app/            → Infrastructure (auth, config, filters, interceptors, health, logger)
  modules/        → Feature modules (one per domain entity)
    <feature>/
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
      repositories/
        <concern>.repository.ts → Persistence operations for an entity,
                                  aggregate, or read model
      dtos/
        input/    → Create/Update DTOs (class-validator + @ApiProperty)
        output/   → Response DTOs (@ApiProperty only)
  database/       → Entities, migrations, seeders, factories
  shared/         → Shared types and utilities
  commands/       → CLI commands (nest-commander)
```

## Architecture boundaries

ESLint `boundaries` plugin enforces module isolation:

- Feature modules (`src/modules/*`) cannot import each other
- Only `shared/` and `app/` are allowed for cross-imports
- `app/` layer cannot import business modules

## Persistence seam

Repositories encapsulate persistence. The dependency flow is:

```text
Controller → Service → Repository → EntityManager
```

- Only repository implementations may inject an `EntityManager` or
  `EntityRepository`; services and controllers never use MikroORM APIs,
  including `find`, `populate`, `flush`, query builders, or transactions.
  Entity definitions, migrations, seeders, database configuration, and
  database-backed tests are the expected exceptions.
- Repositories accept and return entities, IDs, query criteria, or
  query-specific entity graphs—never input or output DTOs. Repository `save`
  methods call `persist(entity)` followed by `flush()`.
- Operations that create or update rows identified by a unique key must use an
  atomic database operation (`upsert`, conflict handling, or an appropriate
  lock). Do not implement them as find-then-insert when concurrent requests are
  possible.
- A read model such as the overview gets a query-focused repository rather
  than being forced through an entity CRUD repository.
- Services instantiate and mutate entities from input DTOs; services or
  controllers map entities to output DTOs. Entity methods expose neutral
  collection accessors so DTO mapping never calls MikroORM `Collection` APIs.
- Extend `EntityRepository<T>` for entity-scoped repositories to inherit
  standard CRUD methods (`findOne`, `findOneOrFail`, `find`, `findAll`,
  etc.). Only add domain-specific methods on top. Query-focused repositories
  that span multiple entities (e.g. overview aggregates) inject
  `SqlEntityManager` directly instead.
- Use one concrete `<concern>.repository.ts` class while MikroORM is the only
  persistence adapter. Do not add a parallel abstract repository plus a
  `MikroOrm*Repository` implementation or generic base repository until a
  second real adapter requires that seam.
- A query shared by multiple repositories, or one that must join a caller's
  transaction (run on the forked `em` of `em.transactional`), lives as an
  `em`-parameterized function in `repositories/<concern>.query.ts`. Only
  repository implementations may call it — it is inside the persistence seam,
  not a service-facing interface
  ([ADR 0008](../../docs/adr/0008-shared-queries-as-em-parameterized-functions.md)).
- The persistence seam is framework-free: repository-layer code (including
  `.query.ts` helpers) signals a vanished row with MikroORM's `NotFoundError`
  — which the exception filter maps to 404 — never with a NestJS HTTP
  exception.

## Manual ordering

- Ordering is the **parent's** concern. A child's `position` column is the
  parent's ordering encoded on child rows as a persistence detail; child
  endpoints never accept or expose ordering writes beyond what the parent
  operation decides. A workstream's _scope_ is the set of the project's
  workstreams sharing one group (ungrouped is its own scope); positions are
  contiguous from 0 within each scope. Steps within a workstream and
  checklist items within a step are contiguous from **1** — several guards
  rely on 0 being an impossible step position, so keep the bases as they are.
- Reorder operations use the **order-callback idiom**: the repository method
  (`reorder`, `reorderScope`) locks the ordering root (project or workstream
  row), loads the scope in current order, and hands it to a service-supplied
  callback that decides membership and final order — throwing the 409 inside
  the callback so the transaction rolls back. The repository then rewrites
  positions contiguously; renumbering is single-phase under the deferred
  unique constraint (no temporary positions).

## Entity definitions (MikroORM 7)

See [ENTITIES_STANDARDS.md](./ENTITIES_STANDARDS.md).

### Migrations

- Create after entity changes: `pnpm --filter api mikro-orm migration:create`
- Verify zero schema diff: `pnpm mikro-orm schema:update --dump`
- CLI uses SWC as TS loader (`tsLoader: "swc"` in package.json)
- In production, migrations run at container start — see
  [ADR 0001](../../docs/adr/0001-migrations-run-on-container-start.md)

## DTOs

- Input DTOs: `class-validator` decorators + `@ApiProperty` for Swagger
- Output DTOs: `@ApiProperty` only (no validation on responses)
- Plain classes with `!` non-null assertions, no base class
- Actor identity comes from the authenticated request. Mutation DTOs never
  accept an actor, author, or current-user ID when the server can determine it.
- Use one canonical output DTO per entity by default. Aggregate responses
  compose those DTOs rather than introducing near-duplicate projections.
  Create a read-model-specific entity DTO only when its shape is materially
  different, not merely a subset or a few additional derived fields.

## Environment config

- Zod schemas for env validation (not class-validator) — the split is
  deliberate, see [ADR 0002](../../docs/adr/0002-dual-validation-stack.md)
- Base schema in `src/shared/types/env.base.schema.ts`
- App-specific schema extends base in `src/app/config/env.schema.ts`

## Error handling

- `AllExceptionsFilter` catches everything, converts MikroORM `NotFoundError` → 404
- `ProblemDetailsFilter` formats HTTP exceptions per RFC 9457
- `nestjs-cls` provides request/correlation/trace IDs

## Testing

- E2E tests: `src/__e2e-tests__/`, named `*.e2e-spec.ts`, serial execution, real PostgreSQL
- Vitest configs: `vitest.config.mts` (unit) and `vitest.e2e.config.mts` (e2e)
- The serial e2e suite can flake under heavy machine load: rotating single
  failures with boot-time 401/404s in unrelated specs. Re-run on an idle
  machine before diagnosing a "failure" that moves between specs.

## Tenancy enforcement

- Every route that reads or writes project data embeds the membership
  predicate (`projectVisibleTo(currentUserId)`) at the resource's FK depth to
  project; a non-member gets a 404 indistinguishable from a nonexistent id.
- `CurrentUserInterceptor` is bound globally; opt out only with
  `@SkipUserResolution()` and a reason of the same weight as `/users/me`
  (the route provisions the row resolution requires).
- **Every new or changed route must have a tenancy e2e assertion**: add it to
  the `ROUTES` table in `tenancy-enforcement.e2e-spec.ts` (non-member 404 +
  soft-deleted 404), or add a justified exemption there. The sweep's coverage
  meta-test fails until one of the two happens.
