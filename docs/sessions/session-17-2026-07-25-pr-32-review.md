# Session 17 — PR #32 Review (2026-07-25)

## Context

Reviewed GitHub PR
[#32 — Auth v1.1](https://github.com/jeremy-dardour/wedding-planner/pull/32)
on branch `auth-v1.1` against `main`.

This session produced a durable review artifact for later pickup:

- [docs/reviews/pr-32-review.md](../reviews/pr-32-review.md)

## What was done

- Reviewed the branch diff `main...HEAD`.
- Checked the implementation against the auth-session-restore plan in
  [session-15-2026-07-24-auth-session-restore-plan.md](./session-15-2026-07-24-auth-session-restore-plan.md)
  and the V1 tech design.
- Added a code-review pass using the `codebase-design` lens to check for
  shallow seams and overengineering.
- Wrote the full review to
  [docs/reviews/pr-32-review.md](../reviews/pr-32-review.md).

## Main findings

- High: transport-driven logout currently bypasses the React refresh seam, so a
  `401` can clear provider state without forcing auth consumers out of the
  authenticated UI.
- Medium: normal API `403` responses do not currently clear the stored token or
  move the app into the forbidden state, even though that behavior is part of
  the auth-session-restore contract.

## Codebase-design note

`GoogleAuthProvider` is mostly becoming a deeper module: more auth behavior is
hidden behind the same small `AuthProvider` interface.

The main shallow seam is the logout path split between:

- `AuthProviderBoundary` for React refresh
- `createAuthMiddleware()` for transport-driven invalidation

That split is the main design issue surfaced by the review.

## Validation

- Static review only; no tests or runtime verification were run in this session.
