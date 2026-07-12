# Standards: API

Inherits: [Global standards](../../STANDARDS.md)

## Module structure

```
src/
  app/            → Infrastructure (auth, config, filters, interceptors, health, logger)
  modules/        → Feature modules (one per domain entity)
    <feature>/
      <feature>.module.ts
      <feature>.controller.ts
      <feature>.service.ts
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

## Entity definitions (MikroORM 7)

This project uses `TsMorphMetadataProvider` — TypeScript types are the single source of truth for entity metadata. Never duplicate in decorators what TsMorph can infer from the TS type.

### Decorator imports

```typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/core';
```

Legacy decorator mode is required by NestJS. Decorators come from `@mikro-orm/decorators/legacy`, types from `@mikro-orm/core`.

### Nullability

Let TypeScript drive nullable inference. Do NOT add `nullable: true` in decorators.

```typescript
@Property({ type: 'text' })
description?: Opt<string | null>;
```

- `?` — property omittable in `em.create()`
- `| null` — database column is nullable
- `Opt<T>` — property has a default or is optional in create operations

### Explicit vs inferred decorator options

| Scenario               | Explicit?             | Why                                       |
| ---------------------- | --------------------- | ----------------------------------------- | ----- |
| `string` property      | No                    | Maps to `varchar(255)` by default         |
| `string` → `text`      | `type: 'text'`        | TsMorph can't distinguish varchar vs text |
| UUID primary key       | `type: 'uuid'`        | TS type is `string`, can't infer UUID     |
| `Date` → `timestamptz` | `type: 'timestamptz'` | Explicit DB type for schema stability     |
| Nullable               | No                    | TsMorph infers from `?` / `               | null` |
| `length: 255`          | No                    | Default for varchar                       |
| `defaultRaw`           | Always                | Database-level default, not type info     |

### Example entity

```typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/decorators/legacy';
import type { Opt } from '@mikro-orm/core';

@Entity()
export class Item {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: Opt<string>;

  @Property()
  name!: string;

  @Property({ type: 'text' })
  description?: Opt<string | null>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Opt<Date>;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Opt<Date>;
}
```

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
