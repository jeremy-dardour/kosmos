# CLAUDE.md

Kosmos is a visual project-management application built as a NestJS API and React SPA.

See [README.md](./README.md) for project overview, setup, and CI pipeline.

## Visibility

**This repository may be made public.** Do not commit personal information —
names of the couple or helpers, private career/life plans, or anything similar.
Use generic placeholders instead ("the couple", "a partner", "a helper"); Jeremy's
own first name is acceptable. When in doubt, grep the change before committing.

## Documentation map

Project knowledge — one home per fact. Read these to get oriented:

| Doc                                                                                              | Holds                                                                |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| [docs/specs/v1-product/PRD.md](./docs/specs/v1-product/PRD.md)                                   | **V1 Product PRD** — what V1 does, behavior, edge cases, rationale   |
| [docs/specs/v1-product/api-contract.md](./docs/specs/v1-product/api-contract.md)                 | V1 design-time API spec (OpenAPI is the live contract)               |
| [docs/specs/v1-product/overview-rework-plan.md](./docs/specs/v1-product/overview-rework-plan.md) | Phased build plan for the #40 overview rework                        |
| [docs/project-purpose.md](./docs/project-purpose.md)                                             | Why the project exists, who it's for, scope boundaries               |
| [CONTEXT.md](./CONTEXT.md)                                                                       | Domain glossary — entities, statuses, rules                          |
| [docs/current-state.md](./docs/current-state.md)                                                 | The live "where we are" — phase, status, next steps, open questions  |
| [docs/sessions/](./docs/sessions/)                                                               | One dated summary per session (what was done, learnings, status)     |
| [docs/reviews/](./docs/reviews/)                                                                 | PR review write-ups, point-in-time; deleted once fully actioned      |
| [docs/prototype/overview-editing/](./docs/prototype/overview-editing/)                           | UI direction — inline overview editing, decisions and rejected ideas |
| [docs/entity-schema-design.md](./docs/entity-schema-design.md)                                   | Concrete MikroORM schema spec (entities, columns, constraints)       |
| [apps/api/module-layout.md](./apps/api/module-layout.md)                                         | NestJS module structure and boundary rules                           |
| [docs/specs/v1-tech-design.md](./docs/specs/v1-tech-design.md)                                   | V1 technical design — links schema, API, state machine, auth, deploy |
| [docs/adr/](./docs/adr/)                                                                         | Technical/architectural decisions                                    |
| [docs/provisioning.md](./docs/provisioning.md)                                                   | One-time production infrastructure provisioning                      |
| [deployment/README.md](./deployment/README.md)                                                   | Production deploy, rollback, backup, and restore operations          |

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
- **Session summaries.** When logging or closing a session, use the
  `log-session` skill and update `current-state.md` at session end.

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

**Never assume the default ports (5432 / 3000 / 5173)** — this checkout may be a
parallel workspace with randomized ports. Read the value from the right file
before curling, screenshotting, or connecting: [PORTS.md](./PORTS.md).

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

- Before declaring work done: `pnpm check-types && pnpm lint && pnpm format:check && pnpm test`
- After regenerating API types, run the web typecheck with `tsc -b --force` —
  turbo's incremental buildinfo has false-passed a stale generated-type change.
- After changing API routes, authentication, persistence, transactions, or
  concurrency behavior, also run `pnpm --filter api test:e2e`.
- After changing entities: regenerate and verify migrations (see
  [apps/api/README.md](./apps/api/README.md)).
- After adding, removing, renaming, or changing API controllers, routes, DTOs,
  Swagger decorators, auth responses, or any endpoint behavior: run
  `pnpm generate:api-types` and commit the regenerated
  `packages/api-contracts/src/openapi.d.ts`. Never hand-edit that generated
  file. Running `pnpm generate:api-types` is always authorized for this
  project, including its connection to the configured local API.
- Creating GitHub pull requests for this repository and posting top-level PR
  conversation comments is always authorized.
- When a follow-up ticket continues on an open PR's branch, its build plan is
  posted as a top-level PR comment, not committed as a docs file (the PR is
  the point-in-time record; `docs/` keeps only durable facts).
- An implementation phase closes with a review battery before the session
  log: two-axis `/code-review` (standards + spec), a security-review
  subagent over the whole branch diff, and a simplification subagent using
  the `codebase-design` skill — findings triaged by the orchestrator and
  actioned in-branch.

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
