# ADR 0008: Shared queries as `em`-parameterized functions inside the persistence seam

**Status:** Accepted — 2026-07

## Decision

A query that must run inside a caller's transaction, or is shared by several
repositories, lives as a plain function taking an `EntityManager` as its first
parameter, in `repositories/<concern>.query.ts` (e.g. `note-count.query.ts`,
`lock-project-order.query.ts`). Only repository implementations may call these
functions — they sit **inside** the persistence seam and are not a
service-facing interface. Services keep depending exclusively on injected
repositories.

## Why not a repository method

Injectable MikroORM repositories are bound to the request-scoped
`EntityManager`. Queries that must join a repository's own transaction — the
overview's note counts inside its repeatable-read snapshot, the project-order
lock inside a renumbering transaction — have to run on the **forked** `em` of
`em.transactional(...)`, which an injected repository never sees. The
alternatives all cost more:

- An `em` parameter on a repository method leaks MikroORM plumbing into the
  repository's interface.
- Letting the service fetch the data in a second repository call breaks the
  one-snapshot guarantee and moves aggregate assembly to the caller.
- Duplicating the SQL per repository loses locality.

## Trade-offs

- **Lost:** the helper itself is not DI-substitutable. Acceptable: the test
  surface is the repository interface (services stub repository methods;
  repositories are covered by DB-backed tests), never the helper.
- **Gained:** one implementation usable from both execution contexts
  (request-scoped and forked transactional `em`), with the seam services see
  unchanged.
