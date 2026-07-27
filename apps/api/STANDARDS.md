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
- A read model such as the overview gets a query-focused repository rather
  than being forced through an entity CRUD repository.
- Services instantiate and mutate entities from input DTOs; services or
  controllers map entities to output DTOs. Entity methods expose neutral
  collection accessors so DTO mapping never calls MikroORM `Collection` APIs.
- Use one concrete `<concern>.repository.ts` class while MikroORM is the only
  persistence adapter. Do not add a parallel abstract repository plus a
  `MikroOrm*Repository` implementation or generic base repository until a
  second real adapter requires that seam.

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
