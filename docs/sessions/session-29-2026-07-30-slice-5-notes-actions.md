# Session 29 — Slice 5 notes actions (2026-07-30)

## What was done

- Implemented per-step note creation, editing, and deletion in the read-only and
  pipeline-editing views for issue #22.
- Added server-owned author identity, author-only mutation guards, input
  validation, and API E2E coverage.
- Replaced the global notes section with the approved collapsible per-step
  pattern from the edition prototype.
- Regenerated the OpenAPI contract and documented standing authorization for
  API type generation in `CLAUDE.md`.
- Added stateful MSW coverage and integration tests for note grouping,
  mutations, authorization failures, and pipeline-draft preservation.
- Verified types, lint, formatting, builds, unit tests, API E2E tests, and the
  database schema.

## Decisions

- Each existing step owns one independently collapsible notes section in both
  normal and edition modes; unsaved draft steps cannot accept notes.
- The edition prototype is the visual source of truth; implementation stays
  deliberately simple where the prototype is silent.
- Note mutations preserve an in-progress pipeline draft.
- Author-only editing and deletion are enforced in both the frontend and API.

## Learnings / tensions surfaced

- Database timestamps can be ahead of the application clock, so note updates
  advance `updatedAt` monotonically to keep the edited indicator reliable.
- Notes remain a separate on-demand query; mutations invalidate only that
  query, not the overview aggregate.

## Status at end of session

Slice 5 is implemented and fully verified on `feat/slice-5`. The remaining
handoff is the requested two-axis code review and draft PR publication.
