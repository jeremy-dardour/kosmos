# Session 12 — PR #28 Review Fix WIP (2026-07-23)

## What was done

- Reviewed PR #28 (`feat: entities + initial migration`) against `origin/main`
  and issue #17.
- Found that the PR was not merge-ready:
  - `pnpm lint` failed on deferred `require()` callbacks in entity decorators.
  - API e2e tests failed in CI with `Cannot find module './workstream.entity'`
    from the same deferred `require()` pattern.
  - The auth e2e suite still used `/items` as its protected endpoint after PR
    #28 removed the Item controller, so auth tests returned 404.
  - `currentStep` was modeled as `@OneToOne`, generating an unintended
    `unique (current_step_id)` constraint.
  - `workstream.current_step_id` could point to a step from another
    workstream, and `workstream.group_id` could point to a group from another
    project.
  - `CLAUDE.md` did not clearly require regenerating API contracts after API
    surface changes.
- Began fixing the PR:
  - Replaced the runtime `require()` decorator callbacks with import/string
    entity references.
  - Changed `currentStep` from `@OneToOne` to `@ManyToOne`.
  - Added intended composite FK metadata for same-project groups and same-
    workstream current steps.
  - Switched boolean DB defaults to `defaultRaw: 'false'`.
  - Added a test-only protected e2e route at `/__e2e__/protected` and pointed
    auth e2e tests at it.
  - Updated `CLAUDE.md` to explicitly require `pnpm generate:api-types` after
    route/controller/DTO/API behavior changes.

## Verification

- `pnpm --filter api test:e2e` passes after the test-only protected route.
- `pnpm --filter api lint` passed after replacing `require()` callbacks, then
  remained clean after the import-order fix.
- `pnpm --filter api check-types` initially passed after replacing
  `require()` with normal imports.

## Current blocker

The latest WIP changes switch cyclic relation decorators to string entity names
to avoid MikroORM CLI CommonJS circular-initialization failures. That uncovered
new TypeScript and MikroORM CLI issues:

- `pnpm --filter api check-types` now fails because legacy decorator overloads
  do not accept `() => 'EntityName'` string callbacks.
- `DATABASE_URL=postgres-test://... pnpm --filter api exec mikro-orm
migration:create --dump` fails with MikroORM metadata type extraction
  (`Cannot read properties of undefined (reading 'toLowerCase')`).

This WIP should be resumed by choosing a relationship declaration pattern that
satisfies all three constraints at once:

- TypeScript strict checking.
- ESLint without unsafe `require()`.
- MikroORM CLI metadata discovery under SWC/CommonJS.

The generated migration, snapshot, API contract regeneration, PR comment, and
final verification have not been completed yet.
