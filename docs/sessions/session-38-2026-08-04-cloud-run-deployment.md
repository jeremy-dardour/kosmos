# Session 38 — Cloud Run deployment (2026-08-04)

## What was done

- Resumed issue
  [#26](https://github.com/jeremy-dardour/wedding-planner/issues/26) from
  `HANDOFF-issue-26.md`. At pickup, the infrastructure decisions and
  implementation plan were locked, Neon and the GitHub production environment
  were configured, GCP setup was in progress, C1 was reviewed, C2 awaited
  review, and C3 was only a worktree draft.
- Assembled `feat/deploy` and opened
  [PR #58](https://github.com/jeremy-dardour/wedding-planner/pull/58) with the
  C1–C6 implementation and provisioning guide.
- Added the `NULLS NOT DISTINCT` migration and regression coverage for
  ungrouped workstream positions.
- Added opt-in Nest static serving with SPA fallback exclusions for API,
  health, OAuth discovery, and OpenAPI routes.
- Built one production image containing the API and SPA, with migrations run
  before Nest starts. Corrected the image target to Linux AMD64 after the
  Apple-Silicon build could not start on Cloud Run.
- Added guarded post-CI deployment and nightly database-backup workflows,
  including immutable image tags, WIF authentication, buffered dump uploads,
  and production-environment configuration.
- Added the production provisioning guide and deployment runbook covering
  first deploy, rollback, migration rehearsal, backups, restore, and
  operational checks.
- Applied the branch review findings: restricted manual production deploys to
  `main` and prevented failed `pg_dump` streams from leaving normal-looking
  truncated objects.
- Investigated slow API E2E coverage runs. Restored MikroORM metadata caching
  to a writable `/tmp` location in production and returned the CI timeout from
  six minutes to three.
- Kept `TsMorphMetadataProvider` in development and production while making
  MikroORM 7's production CLI prefer compiled JavaScript via
  `MIKRO_ORM_CLI_PREFER_TS=false`.
- Recorded the single-container static-serving decision and its change
  triggers in [ADR 0011](../adr/0011-spa-served-by-nest.md).
- Moved the unified Dockerfile, entrypoint, and runbook from the API subtree to
  the shared root [`deployment/`](../../deployment/) directory.
- Verified the final image build locally. PR #58's complete CI suite passed at
  commit `52e8aae`.

## Decisions

- Cloud Run, direct Neon connectivity, WIF, scaling, backup retention, and
  environment decisions remain as recorded in
  [issue #26](https://github.com/jeremy-dardour/wedding-planner/issues/26) and
  the [V1 technical design](../specs/v1-tech-design.md#deployment).
- The SPA is served by Nest for the current single-deployable architecture;
  the reasons and conditions for splitting it onto a static host or CDN are in
  [ADR 0011](../adr/0011-spa-served-by-nest.md).
- Deployment artifacts are owned by the application deployment as a whole,
  not by `apps/api`, so they live together under `deployment/`.
- PR #58 must not be merged until Jeremy has reviewed it.

## Learnings / tensions surfaced

- A `workflow_run` deployment workflow becomes active only from the default
  branch. The hardened manual-dispatch guard also deliberately prevents using
  the feature branch to bypass CI and test production deployment before merge.
- Cloud Run accepts Linux AMD64 images; a locally built ARM image can push
  successfully but cannot produce a healthy revision.
- MikroORM 7 recognizes `MIKRO_ORM_CLI_PREFER_TS`, not the former
  `MIKRO_ORM_CLI_USE_TS_NODE`. This controls source preference independently
  from the selected metadata provider.
- Disabling MikroORM's metadata cache made API E2E coverage exceed six
  minutes. A writable production cache under `/tmp` preserves the provider and
  avoids writes to the read-only application tree.
- Serving the SPA from Nest simplifies origin, OAuth, releases, and rollback,
  but couples web/API availability and scaling and gives static assets Cloud
  Run cold-start latency.

## Status at end of session

PR #58 is open, mergeable, and green at `52e8aae`; it remains unmerged for
Jeremy's review. The repository work for #26 is implemented. After merge, a
successful `main` CI run should exercise CD for the first time; production
health, OAuth, the first nightly backup, and the restore drill still need live
verification before issue #26 is closed.
