# Template API

NestJS backend for the fullstack template. Exposes a typed, contract-first REST API with OpenAPI and uses MikroORM for PostgreSQL persistence.

## Setup

1. Copy `.env.example` to `.env` and configure variables
2. Start database: `pnpm db:start`
3. Run migrations: `pnpm db:migrate:up`
4. Seed development data: `pnpm db:seed:local`
5. Start API: `pnpm dev`

## OpenAPI Contract

- API contract is exposed at `/openapi.yaml` when running
- Types are generated via `pnpm generate:api-types` at the root and stored in `packages/api-contracts`
- **Never** edit types manually; always update via OpenAPI

## Development Standards

- Controllers are thin, DTOs are explicit and validated
- Entities are not exposed directly; always map to DTOs
- All cross-app types flow through OpenAPI and `packages/api-contracts`

## MikroORM & TsMorphMetadataProvider

- MikroORM uses the TsMorphMetadataProvider, meaning **TypeScript types are the source of truth for your database schema**
- Stay DRY: define your entity structure in TypeScript, and decorators only where they affect runtime (e.g., `@PrimaryKey`, `@Property({ unique: true })`, `@ManyToOne`)
- Avoid repeating type, nullable, or length info in decorators if TypeScript already expresses it
- All entity metadata must be statically analyzable — avoid dynamic decorators or runtime tricks

## API DTOs & OpenAPI Annotations

- API contract is defined by explicit DTOs, **not entities**
- Use `@ApiProperty` and `@ApiPropertyOptional` for every DTO field
- Always specify required, nullable, enum, and format (uuid, date-time, etc.) in DTOs
- DTOs must align with runtime validation (`class-validator`)
- Proper OpenAPI annotations ensure correct type generation for frontend consumers

## Database Migration Workflow

1. Modify entities (TypeScript classes)
2. Generate migration: `pnpm mikro-orm migration:create --name=update_my_entity`
3. Review migration — check for data loss, index changes, nullability
4. Apply: `pnpm db:migrate:up`

> Always review generated migrations before applying to production.

## CLI Commands

The template includes a `nest-commander` CLI shell for background jobs or one-off scripts:

```bash
pnpm command:build-and-run:example
```

Add new commands in `src/commands/`. Environment variables required:

- All mandatory env variables in `env.base.schema.ts`
- All mandatory env variables in `commands/env.schema.ts`

## Scripts

| Script                 | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm dev`             | Start in dev mode                                             |
| `pnpm build`           | Build for production                                          |
| `pnpm test`            | Run unit tests                                                |
| `pnpm test:cov`        | Unit tests with coverage                                      |
| `pnpm test:e2e`        | E2E tests (requires running PostgreSQL)                       |
| `pnpm test:cov:merged` | Unit + E2E coverage merged into one report (`coverage/final`) |
| `pnpm db:start`        | Start PostgreSQL via Docker                                   |
| `pnpm db:migrate:up`   | Run pending migrations                                        |
| `pnpm db:seed:local`   | Seed development data                                         |
| `pnpm lint`            | ESLint                                                        |
| `pnpm check-types`     | TypeScript type checking                                      |
