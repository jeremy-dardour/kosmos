# Session 07 — Auth & API contract PRDs (2026-07-21)

## What was done

- Resolved **ticket 05 (auth approach)**: reviewed the auth research
  ([auth-internals.md](../research/auth-internals.md)), confirmed GIS + static
  `.env` email allow-list with consent screen published "In production"
  (non-sensitive scopes only). Wrote implementation PRD at
  [docs/specs/auth/PRD.md](../specs/auth/PRD.md).
- Resolved **ticket 04 (API contract)**: designed the full REST API — endpoints,
  input/output DTOs, overview read model, error codes. Wrote spec at
  [docs/specs/api-contract/PRD.md](../specs/api-contract/PRD.md).
- Reviewed the API contract and fixed several issues (see Learnings below).
- Created **ticket 09 (state machine implementation)** — grilling for the
  transactional `start`/`advance` logic with MikroORM.
- Updated the wayfinder map with resolved decisions.
- Decided to skip the intermediate grilling ceremony for remaining tickets and
  write PRDs directly going forward.

## Decisions

- Auth: GIS + `.env` allow-list (see ticket 05 answer).
- API: single overview aggregate read, named RPCs for `start`/`advance`, flat
  CRUD for sub-entities, all derived state server-side (see ticket 04 answer).
- Module structure: one `project` module owns everything (no cross-module
  boundaries at this scale). Updates the split in
  [module-layout.md](../module-layout.md).
- No standalone `GET` for workstreams — overview provides all data; mutations
  return updated state.
- Notes fetched per-workstream (`GET /workstreams/:workstreamId/notes`) not
  per-step — detail panel shows all steps' notes.
- Checklist items included inline in overview (small payload), no separate GET.

## Learnings / tensions surfaced

- API contract review surfaced gaps the initial draft missed:
  - Client needs a way to discover the project ID (`GET /projects` list).
  - `nearestDeadline` must include overdue deadlines (negative `daysUntil`), not
    skip them.
  - Past-step mutability must guard attribute edits (PATCH), not just structural
    operations — and checklist items on past steps must also be frozen.
  - The detail panel note-loading pattern matters: per-step fetching is chatty;
    per-workstream is one call.
- State machine implementation (how `start`/`advance` work transactionally with
  MikroORM) is a real question that needs its own grilling before building.

## Status at end of session

Pre-implementation — auth and API contract PRDs written, deploy decision
deferred. Next: review the hosting research (ticket 06), grill state machine
implementation (ticket 09), then sequence the build increments.
