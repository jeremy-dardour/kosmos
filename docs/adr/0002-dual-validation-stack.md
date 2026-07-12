# ADR 0002: zod for env/config, class-validator for DTOs

**Status:** Accepted — 2026-07

## Decision

The API deliberately uses two validation libraries:

- **class-validator + class-transformer** for HTTP DTOs
  (`apps/api/src/**/dtos/`), wired through Nest's global `ValidationPipe`.
- **zod** for environment/config validation
  (`apps/api/src/app/config/env.schema.ts`) and any non-HTTP parsing.

## Why not one library?

The OpenAPI contract pipeline is the deciding factor: `@nestjs/swagger` reads
class-validator decorators to generate the OpenAPI spec, which
`pnpm generate:api-types` turns into the frontend's typed client
(`@workspace/api-contracts`). Replacing class-validator (e.g. with nestjs-zod)
would put a less mature integration in the middle of the template's main
type-safety guarantee.

Conversely, class-validator is class/decorator-shaped and awkward for plain
objects like `process.env`; zod is the better tool there and gives inferred
`Env` types for `ConfigService<Env, true>`.

## Consequence

Contributors must know the rule: **HTTP boundary → class-validator decorators
(they feed Swagger); everything else → zod.** Do not add a third library.

## When to revisit

If zod-first OpenAPI generation matures (or the API moves off
`@nestjs/swagger`), consolidating on zod removes the split and the
class-transformer dependency.
