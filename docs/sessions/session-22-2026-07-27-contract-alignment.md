# Session 22 — Remaining-slice contract alignment (2026-07-27)

## What was done

- Reviewed and updated GitHub issues
  [#19](https://github.com/jeremy-dardour/wedding-planner/issues/19)–[#24](https://github.com/jeremy-dardour/wedding-planner/issues/24)
  and [#26](https://github.com/jeremy-dardour/wedding-planner/issues/26)
  against merged auth v1.1 and Slice 1.
- Aligned the
  [API contract](../specs/v1-product/api-contract.md),
  [V1 tech design](../specs/v1-tech-design.md), API/web/entity standards,
  [module layout](../../apps/api/module-layout.md), and
  [current state](../current-state.md).
- Corrected the nullable enum example and the false claim that MikroORM
  generates deferrable ordered-position constraints.
- Audited the auth and Slice 1 session logs for reusable standards.

## Decisions

- Canonical entity DTO reuse, detail loading, query invalidation, user reuse,
  and reorder behavior are recorded in the
  [API contract](../specs/v1-product/api-contract.md).
- Repository ownership of persistence and the threshold for specialized entity
  DTOs are recorded in the
  [API standards](../../apps/api/STANDARDS.md).
- Selected-entity state and mutation invalidation are recorded in the
  [web standards](../../apps/web/STANDARDS.md).

## Learnings / tensions surfaced

- A second detail representation was not justified when `outcomeAt` was the
  only meaningful missing field; aggregate envelopes can reuse canonical entity
  DTOs without eliminating query-focused repositories.
- Cache invalidation follows response ownership: notes do not invalidate an
  overview that contains no note-derived data.
- `CLAUDE.md` links to a missing `docs/sessions/README.md`; the log-session
  skill's fallback template was used.
- Five additional standards candidates remain for user review: constraint-only
  comments, stable external-store snapshots/component types, server-trusted
  actor identity, indexed OpenAPI schema access, and clean-checkout monorepo
  build dependencies.

## Status at end of session

All seven tickets and their canonical technical documents are aligned. The
branch is ready for the canonical DTO implementation follow-up; no application
code changed in this session.
