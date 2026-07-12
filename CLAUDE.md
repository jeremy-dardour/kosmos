# CLAUDE.md

Production-ready fullstack monorepo template: NestJS API + React SPA + shared tooling.

See [README.md](./README.md) for project overview, setup, and CI pipeline.

## Monorepo structure

```
apps/
  api/          → NestJS REST API
  web/          → React SPA
packages/
  api-contracts/  → OpenAPI-generated TypeScript types
  eslint-config/  → Shared ESLint flat config
  shared/         → Shared utilities
  typescript-config/ → Shared tsconfig presets
```

## Commands

```bash
pnpm dev                        # Start all apps
pnpm check-types                # TypeScript type checking
pnpm lint                       # ESLint
pnpm test                       # Unit tests
pnpm --filter api test:e2e      # API E2E tests
pnpm --filter web test:e2e      # Web E2E tests
pnpm generate:api-types         # Regenerate OpenAPI types from running API
```

## Standards

See [Global standards](./STANDARDS.md) — TypeScript, imports, naming, testing basics
See [API standards](./apps/api/STANDARDS.md) — entities, modules, DTOs, architecture boundaries
See [Web standards](./apps/web/STANDARDS.md) — components, hooks, API layer, auth, i18n

## Decisions

Architectural trade-offs live in [docs/adr/](./docs/adr/) as compact ADRs
(migrations at container start, zod vs class-validator split, trust proxy).
Consult them before "fixing" what they document; record new decisions of that
kind as the next numbered ADR.

## Workflow

- Before declaring work done: `pnpm check-types && pnpm lint && pnpm test`
- After changing entities or endpoints: regenerate migration / API types (see
  [apps/api/README.md](./apps/api/README.md)); never hand-edit
  `packages/api-contracts/src/openapi.d.ts`
