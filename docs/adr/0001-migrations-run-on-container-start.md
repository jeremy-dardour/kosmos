# ADR 0001: Database migrations run on container start

**Status:** Accepted — 2026-07

## Decision

The API container entrypoint (`apps/api/deployment/entrypoint.app.sh`) runs
`mikro-orm migration:up` before starting the app, unconditionally. The
`@mikro-orm/cli` package therefore ships in the production image.

## Why

This template is a fork-and-go foundation. Migrate-on-start gives every fork a
zero-configuration deploy story: push an image anywhere that runs containers
and the schema is always current. No pipeline machinery, no ordering between
"run migrations" and "roll the app".

## Consequences for scaling

Migrate-on-start is scaling-**tolerant** but not scaling-**clean**:

- **Concurrent replica starts race.** MikroORM takes no distributed lock.
  With N replicas starting at once, one wins; losers fail on the migration
  transaction, exit non-zero, and are restarted by the orchestrator — by then
  nothing is pending. Worst case is a one-time crash-loop blip during a
  rolling deploy, not corruption (`allOrNothing: true` keeps each run atomic).
- **Slow migrations block readiness.** A long backfill or index build runs
  inside the startup path, so readiness probes can time out and mark a deploy
  failed while the migration is still legitimately running.

## When to revisit

When a fork has real traffic or multiple replicas, move migrations to a
deploy step (CI job or one-off task) and delete the migration block from the
entrypoint. The app image keeps working unchanged; only the entrypoint and
the deploy pipeline move.
