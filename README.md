# Kosmos

Kosmos keeps project workstreams, steps, ownership, and deadlines together in
one ordered view. The application is a **NestJS** API and **React** frontend in
a shared TypeScript monorepo.

## Tech Stack

| Layer        | Technologies                                                                       |
| ------------ | ---------------------------------------------------------------------------------- |
| **Monorepo** | Turborepo, pnpm workspaces                                                         |
| **Frontend** | React 19, Vite 8, TanStack Query 5, shadcn/ui (Tailwind CSS 4), Playwright, Vitest |
| **Backend**  | NestJS 11, MikroORM 7, PostgreSQL, Swagger/OpenAPI, jose (JWT)                     |
| **Shared**   | TypeScript 6, ESLint 10 (flat config), Prettier, OpenAPI contract generation       |

## Architecture

```
apps/
  api/                → NestJS REST API (see apps/api/README.md)
  web/                → React SPA (see apps/web/README.md)
packages/
  api-contracts/      → OpenAPI-generated TypeScript types
  eslint-config/      → Shared ESLint flat config
  shared/             → Shared utilities (see packages/shared/README.md)
  typescript-config/  → Shared tsconfig presets
```

## Quick Start

### Prerequisites

- Node.js (see `.nvmrc`)
- pnpm >= 10
- Docker (for PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start the database
docker compose up -d db

# Run migrations
pnpm --filter api db:migrate:up

# Seed development data
pnpm --filter api db:seed:local

# Start all apps in dev mode
pnpm dev
```

The API runs at `http://localhost:3000/api` and the frontend at `http://localhost:5173`.

- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI spec: `http://localhost:3000/openapi.yaml`

### Running Parallel Workspaces

Postgres, the API, and the Vite dev server all read their ports from `.env`
files, so multiple checkouts of this repo (e.g. parallel conductor
workspaces) can run `pnpm dev` at the same time without fighting over host
ports. To set one up:

```bash
scripts/setup_parallel_workspace.sh
```

This copies `.env.example` → `.env` for the root, `apps/api`, and
`apps/web`, filling in random free ports for Postgres, the API, and the web
dev server. The E2E test database port is handled separately — see
[apps/api/README.md](./apps/api/README.md#parallel-workspace-ports).

[PORTS.md](./PORTS.md) lists which file holds which port, and the gotchas
(Vite's IPv6-only bind, its silent fallback to the next free port).

## Platform

### Authentication

A Google Identity Services authentication system for a small allow-listed group:

- **Strategy pattern**: `AuthGuard` → `AuthStrategy` interface → `JwtAuthStrategy` / `MockAuthStrategy`
- **JWT verification**: Google ID token JWKS, audience, issuer, and email allow-list validation via `jose`
- **OIDC discovery**: Automatic metadata and JWKS endpoint resolution
- **Dev mode**: `FAKE_AUTH=true` bypasses auth for local development

Configure Google auth with three env vars:

```env
AUTH_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
AUTH_CLIENT_ID=your-google-client-id
AUTH_ALLOWED_EMAILS=person@example.com,another-person@example.com
```

### CLI Commands

A `nest-commander` CLI shell for background jobs, data migrations, or one-off scripts:

```bash
pnpm --filter api command:build-and-run:example
```

### API Contract Generation

The frontend consumes types generated from the backend's OpenAPI spec — no manual type duplication:

```bash
# Start the API, then regenerate types
pnpm generate:api-types
```

CI checks for contract drift to prevent frontend/backend type mismatches.

## CI Pipeline

The repository has a comprehensive GitHub Actions CI workflow (`.github/workflows/ci.yml`) that runs on every PR and push to `main`:

| Job                    | What it checks                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Format Check**       | Prettier formatting compliance                                                                                                                            |
| **Check Dependencies** | Dependency health                                                                                                                                         |
| **Check Types**        | TypeScript `--noEmit` across all packages                                                                                                                 |
| **Lint**               | ESLint (flat config) across all packages                                                                                                                  |
| **API Contract Check** | Starts the API, regenerates OpenAPI types, and fails if the generated contract differs from what's committed — catches frontend/backend drift             |
| **Unit Tests**         | Vitest for API and Web (parallel matrix), with coverage upload                                                                                            |
| **API E2E Tests**      | Supertest against a real PostgreSQL service container — tests auth (JWT lifecycle) and CRUD endpoints, collects coverage                                  |
| **Coverage Report**    | Merges API unit + E2E coverage into one report and posts sticky PR comments (API and Web) with the evolution vs `main` (baseline cached from main builds) |
| **Web E2E Tests**      | Playwright in headless Chromium, with report and screenshot artifacts on failure                                                                          |

All jobs use a shared `ci-setup` composite action for consistent Node.js/pnpm setup and caching.

## Scripts

| Script                       | Description                               |
| ---------------------------- | ----------------------------------------- |
| `pnpm dev`                   | Start all apps in dev mode                |
| `pnpm build`                 | Build all apps                            |
| `pnpm check-types`           | TypeScript type checking (all packages)   |
| `pnpm lint`                  | ESLint (all packages)                     |
| `pnpm format`                | Prettier + ESLint fix                     |
| `pnpm test`                  | Unit tests (all packages)                 |
| `pnpm --filter api test:e2e` | API E2E tests (supertest)                 |
| `pnpm --filter web test:e2e` | Web E2E tests (Playwright)                |
| `pnpm generate:api-types`    | Regenerate OpenAPI types from running API |

## Coding Standards

For coding conventions, architecture patterns, and entity definitions, see the standards files:

- [Global standards](./STANDARDS.md) — TypeScript, imports, naming
- [API standards](./apps/api/STANDARDS.md) — NestJS modules, MikroORM entities, DTOs
- [Web standards](./apps/web/STANDARDS.md) — React components, API hooks, auth, i18n
- [Architecture decisions](./docs/adr/) — compact ADRs for the project's technical trade-offs

## License

[MIT](LICENSE)
