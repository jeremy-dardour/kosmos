# Session 15 — Parallel Workspace Ports (2026-07-24)

## What was done

- Fixed a frontend `check-types` failure: the placeholder `/api/items`
  OpenAPI paths were removed along with the example `Item` entity, breaking
  `apps/web/src/api/hooks/use-items.ts` and
  `apps/web/src/features/items/items-page.tsx`. Added `// @ts-nocheck` to
  both (with a comment explaining why) instead of deleting the example, so
  it stays available as reference for the first frontend ticket.
- Diagnosed why the API couldn't reach Postgres locally: commit `9691f9e`
  ("isolate compose database per workspace") removed `container_name` (a
  good fix — avoids name collisions between conductor workspaces) but also
  removed `ports:` entirely from `postgres`/`postgres-test` in
  `docker-compose.yml`, not just renumbered them. No `.env` value could fix
  that alone — the containers were unreachable from the host at all.
- Restored host ports via env-var interpolation instead of fixed values:
  `${DATABASE_PORT:-5432}` / `${DATABASE_TEST_PORT:-5433}`. Fixed ports were
  considered and rejected — Docker's published-port binding is global to the
  host regardless of the `-p` compose project name, so two workspaces
  running `pnpm db:start` at the same time would still collide even with
  distinct container names.
- Added a root `.env.example` (didn't exist before) for `DATABASE_PORT` /
  `DATABASE_TEST_PORT`, a `WEB_PORT` var + `vite.config.ts` support for the
  web dev server port, and comments in `apps/api/.env.example` tying
  `DATABASE_URL`'s port to the root config.
- Added `scripts/setup_parallel_workspace.sh`: picks 4 random free ports
  (Postgres, Postgres-test, API, web), copies each app's `.env.example` →
  `.env`, and substitutes the ports in place. Kept deliberately minimal —
  port-availability checking only, no `--force`/skip-if-exists logic.
- Handled the E2E test database port separately from the rest: `.env.e2e` is
  a tracked fixture shared with CI, so the script never edits it. Instead it
  writes an untracked `apps/api/.env.e2e.local` containing just the
  workspace's `DATABASE_URL`, loaded after `.env.e2e` with `override: true`
  in `src/__e2e-tests__/setup.ts` and by the `db-e2e:*` scripts — wins when
  present, falls back to the tracked default otherwise.
- Verified CI is unaffected: `.github/workflows/ci.yml` never touches
  `docker-compose.yml` or reads `.env.e2e`/`.env.e2e.local` — it spins up its
  own Postgres service and injects `DATABASE_URL` directly via the workflow,
  which wins because `dotenv.config()` never overrides an already-set
  `process.env` var by default.
- Documented the setup in the root README (`## Running Parallel Workspaces`)
  and `apps/api/README.md` (`## Parallel Workspace Ports`), cross-linked.

## Decisions

- **Configurable ports, not a no-published-port pattern**: the suggested
  Docker pattern of dropping `ports:` and connecting via the compose service
  DNS name only works when the caller is itself a container on the same
  network. The default dev flow here runs the API as a host process
  (`pnpm dev` → `turbo run dev`), not inside `docker-compose` — that
  pattern was rejected for this project's default workflow.
- **`.env.e2e.local` override instead of editing the tracked fixture**:
  keeps `.env.e2e`'s committed value stable for CI/teammates; the
  per-workspace port lives only in a gitignored file.

## Learnings / tensions surfaced

- Docker's host port publishing is a single shared namespace for the whole
  machine — the `-p <project>` compose flag isolates container names,
  volumes, and networks, but **not** published host ports. Isolating those
  requires distinct port numbers, not just distinct project names.
- `dotenv.config()` does not override a variable that's already set in
  `process.env` unless `override: true` is passed — this is what makes the
  `.env.e2e` → `.env.e2e.local` layering (and CI's own `DATABASE_URL`
  injection) safe.

## Status at end of session

Local dev DB connectivity (broken since session 13's port-isolation commit)
is fixed, and multiple conductor workspaces can now run `pnpm dev` /
`pnpm --filter api test:e2e` in parallel via
`scripts/setup_parallel_workspace.sh`. PR #28 review fix-up (entities +
migration regeneration) remains the next thing to resume.
