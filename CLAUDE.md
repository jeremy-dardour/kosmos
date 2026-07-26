# CLAUDE.md

Production-ready fullstack monorepo template: NestJS API + React SPA + shared tooling.

See [README.md](./README.md) for project overview, setup, and CI pipeline.

## Visibility

**This repository may be made public.** Do not commit personal information —
names of the couple or helpers, private career/life plans, or anything similar.
Use generic placeholders instead ("the couple", "a partner", "a helper"); Jeremy's
own first name is acceptable. When in doubt, grep the change before committing.

## Documentation map

Project knowledge — one home per fact. Read these to get oriented:

| Doc                                                            | Holds                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| [docs/specs/v1-product/PRD.md](./docs/specs/v1-product/PRD.md) | **V1 Product PRD** — what V1 does, behavior, edge cases, rationale   |
| [docs/project-purpose.md](./docs/project-purpose.md)           | Why the project exists, who it's for, scope boundaries               |
| [CONTEXT.md](./CONTEXT.md)                                     | Domain glossary — entities, statuses, rules                          |
| [docs/current-state.md](./docs/current-state.md)               | The live "where we are" — phase, status, next steps, open questions  |
| [docs/sessions/](./docs/sessions/)                             | One dated summary per session (what was done, learnings, status)     |
| [docs/prototype/](./docs/prototype/)                           | Chosen UI design spec (Pipeline Stack wireframe)                     |
| [docs/entity-schema-design.md](./docs/entity-schema-design.md) | Concrete MikroORM schema spec (entities, columns, constraints)       |
| [docs/module-layout.md](./docs/module-layout.md)               | NestJS module structure and boundary rules                           |
| [docs/specs/v1-tech-design.md](./docs/specs/v1-tech-design.md) | V1 technical design — links schema, API, state machine, auth, deploy |
| [docs/adr/](./docs/adr/)                                       | Technical/architectural decisions                                    |

**Always loaded at session start** (imported so they're in context from the start):

@docs/project-purpose.md
@CONTEXT.md
@docs/current-state.md
@STANDARDS.md

Documentation conventions:

- **Project memory lives in-repo** (the docs above). Do **not** create external
  memory files for this project — record durable project facts here instead.
- **Single home per fact.** Live status lives only in `current-state.md`; domain
  decisions only in `docs/domain-decisions.md`; session files record what
  happened + learnings and link out rather than restating current truth.
- **Session summaries.** When logging or closing a session, add a summary in
  `docs/sessions/` using the template and instructions there
  ([docs/sessions/README.md](./docs/sessions/README.md)). Update
  `current-state.md` at session end.

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

## Ports

**Never assume the default ports (5432 / 3000 / 5173).** This checkout may be a
parallel workspace with randomized ports written by
[`scripts/setup_parallel_workspace.sh`](./scripts/setup_parallel_workspace.sh)
(see [README § Running Parallel Workspaces](./README.md#running-parallel-workspaces)).
Read the value from the file before curling, screenshotting, or connecting:

| What           | Variable             | File                                                           |
| -------------- | -------------------- | -------------------------------------------------------------- |
| Postgres (dev) | `DATABASE_PORT`      | `.env` (root)                                                  |
| Postgres (e2e) | `DATABASE_TEST_PORT` | `.env` (root)                                                  |
| API            | `PORT`               | `apps/api/.env`                                                |
| API → Postgres | `DATABASE_URL`       | `apps/api/.env`                                                |
| API e2e → PG   | `DATABASE_URL`       | `apps/api/.env.e2e.local` if present, else `apps/api/.env.e2e` |
| Web (Vite)     | `WEB_PORT`           | `apps/web/.env`                                                |
| Web → API      | `VITE_API_URL`       | `apps/web/.env`                                                |

Vite binds to `localhost` (IPv6 `::1`) only — use `http://localhost:$WEB_PORT`,
not `127.0.0.1`. If `WEB_PORT` is already taken, Vite silently starts on the
next free port, so confirm the port Vite printed rather than trusting `.env`.

## Standards

[Global standards](./STANDARDS.md) — TypeScript, code style, comments — is
imported above, so it is always in context. The app-specific ones below are
loaded on demand by the path-scoped rules in `.claude/rules/`:

See [API standards](./apps/api/STANDARDS.md) — entities, modules, DTOs, architecture boundaries
See [Web standards](./apps/web/STANDARDS.md) — components, hooks, API layer, auth, i18n

## Decisions

Architectural trade-offs live in [docs/adr/](./docs/adr/) as compact ADRs
(migrations at container start, zod vs class-validator split, trust proxy).
Consult them before "fixing" what they document; record new decisions of that
kind as the next numbered ADR.

## Workflow

- Before declaring work done: `pnpm check-types && pnpm lint && pnpm test`
- After changing entities: regenerate and verify migrations (see
  [apps/api/README.md](./apps/api/README.md)).
- After adding, removing, renaming, or changing API controllers, routes, DTOs,
  Swagger decorators, auth responses, or any endpoint behavior: run
  `pnpm generate:api-types` and commit the regenerated
  `packages/api-contracts/src/openapi.d.ts`. Never hand-edit that generated
  file.

## Agent skills

### Issue tracker

Local markdown, committed under `docs/` — PRDs in `docs/specs/<feature>/`,
build issues tracked as GitHub Issues. See
[docs/agents/issue-tracker.md](./docs/agents/issue-tracker.md).

### Triage labels

The five canonical roles, default strings (`needs-triage`, `needs-info`,
`ready-for-agent`, `ready-for-human`, `wontfix`), written on a `Status:` line.
See [docs/agents/triage-labels.md](./docs/agents/triage-labels.md).

### Domain docs

Single-context — one root `CONTEXT.md` + `docs/adr/`; `CLAUDE.md` is the
documentation map. See [docs/agents/domain.md](./docs/agents/domain.md).
