# Ports

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

A fresh parallel workspace has an **empty** dev database — the setup script
provisions ports, not schema. Run `pnpm --filter api db:migrate:up` before
concluding anything from a `500` on an endpoint that touches the database.
