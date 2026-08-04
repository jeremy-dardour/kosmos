# Session 39 — Production deployment verification (2026-08-04)

## What was done

- Verified the first Cloud Run deployment failure from revision logs: the
  migration process exceeded the 256 MiB limit before Nest could listen.
- Raised the service to 512 MiB. The next revision became healthy with 100%
  traffic, and `/`, `/health`, and `/openapi.yaml` returned 200.
- Confirmed automatic CD later completed successfully for current `main`.
- Reproduced that `/api/docs`, `/api/swagger`, and `/openapi.yaml` were public
  while protected application routes returned 401.
- Added a test-first fix in
  [draft PR #60](https://github.com/jeremy-dardour/wedding-planner/pull/60):
  production no longer registers Scalar, Swagger UI, or the raw OpenAPI
  contract; development and CI behavior is unchanged.
- Recorded the custom domain as deliberately deferred in the
  [deployment runbook](../../deployment/README.md#future-custom-domain).
- Dispatched the nightly backup workflow and fixed three failures found by the
  live verification: an escaped Ubuntu codename, selection of the runner's
  PostgreSQL 16 wrapper instead of the installed PostgreSQL 18 binary, and
  insufficient GCS read/list permissions for `gcloud storage cp`.
- Granted the GitHub deployer bucket-scoped Storage Object Viewer alongside
  its existing Storage Object Creator role and updated the
  [provisioning guide](../provisioning.md).
- Successfully created
  `nightly/2026-08-04T13-45-59Z.sql.gz` in the private backup bucket.
- Downloaded that object to `/tmp`, verified its gzip integrity, and restored
  it with `ON_ERROR_STOP` into isolated disposable Postgres 18. Verified 9
  public tables, 13 foreign keys, and 5 migrations without displaying
  production rows.
- Stopped and removed the disposable database and permanently deleted the
  temporary local dump.

## Decisions

- Production API documentation is disabled rather than given a second auth
  mechanism; its contract remains available to development and CI.
- The custom domain is future work; production continues on its Cloud
  Run-provided `run.app` origin.
- Backup CI retains least-privilege bucket access: create, get, and list, but
  no update or delete. The durable configuration is recorded in the
  [provisioning guide](../provisioning.md).

## Learnings / tensions surfaced

- Cloud Run's generic “failed to listen on PORT” message can mask an earlier
  OOM; revision logs contained the actionable cause.
- Swagger and Scalar mount Express middleware outside Nest's global guard, so
  global controller authentication does not protect their routes.
- Installing `postgresql-client-18` does not guarantee the generic `pg_dump`
  resolves to version 18 on the GitHub runner; the workflow must use the
  versioned binary path.
- Storage Object Creator alone is insufficient for uploads through the
  `gcloud storage` CLI, which also performs get/list operations.
- Buffering the dump before upload worked as intended: every failed run left
  no partial or normal-looking backup object.

## Status at end of session

Production is healthy, automatic CD is proven, the first private backup and
restore drill succeeded, and the custom domain is deferred. Draft PR #60 is
green and unmerged for Jeremy's review; after merge, verify the three
production documentation routes return 404.
