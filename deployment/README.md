# Production deployment runbook

> **Cutover status:** this runbook names the post-rename resources (`kosmos`
> service, `kosmos-runtime` SA, `jeremy-dardour/kosmos` repo). Until the
> [external cutover](../docs/specs/kosmos-rename/implementation-plan.md#phase-5--external-cutover)
> completes, the live resources still carry the `wedding-planner` names —
> substitute accordingly. The cutover itself is [`provision.sh`](./provision.sh)
> (converges the kosmos resources) followed, after verification, by
> [`cutover-teardown-old-name.sh`](./cutover-teardown-old-name.sh) (deletes the
> old-name resources). Remove this note after cutover.

The production deployment is one Cloud Run service in `europe-west1`. It
serves the API and built SPA from the same container and connects directly to
Neon in AWS `eu-central-1`. The single-container web-serving decision and its
trade-offs are recorded in
[ADR 0011](../docs/adr/0011-spa-served-by-nest.md).

One-time infrastructure setup is documented in
[the provisioning guide](../docs/provisioning.md). GitHub secrets and
variables live in the `production` environment. Cloud Run owns runtime
configuration; CD updates only the image.

## First deployment

Follow step 8 of the provisioning guide. The first `gcloud run deploy` creates
the service and sets its runtime service account, scaling, secret, environment
variables, port, and public ingress. Later deployments must pass only the new
image so those settings remain intact.

Cloud Run requires a Linux AMD64 image. When building the first image on an
Apple Silicon machine, pass `docker build --platform linux/amd64`; the CD
workflow sets the platform explicitly as well.

The container entrypoint runs all pending MikroORM migrations before starting
NestJS. A migration failure prevents the revision from becoming ready.

## Future: custom domain

Production currently uses the Cloud Run-provided `run.app` URL. A custom
domain is deliberately deferred and is not required to operate the service.
When revisiting it, follow step 9 of the provisioning guide: verify domain
ownership, create the Cloud Run mapping, add the generated DNS records, wait
for managed TLS, add the new origin to Google OAuth, and verify sign-in.

## Deployments and rollback

Every successful CI run for `main` triggers `.github/workflows/cd.yml`. The
workflow checks out the exact commit CI validated, builds `git-<sha>` and
`latest` image tags, pushes them, and deploys the immutable SHA tag.

List revisions and move all traffic back to a known-good revision:

```bash
gcloud run revisions list \
  --service kosmos \
  --region europe-west1

gcloud run services update-traffic kosmos \
  --region europe-west1 \
  --to-revisions <previous-revision>=100
```

Database migrations are forward-only. Moving traffic restores application
code, not the previous schema. If a migration is incompatible with the former
revision, deploy a forward fix instead of shifting traffic.

## Rehearse a risky migration

Before a destructive or data-transforming migration:

1. Create a Neon branch from the production branch.
2. Copy that branch's direct, non-pooled connection string.
3. Run the candidate migration against it:

   ```bash
   DATABASE_URL='<branch-direct-url>' \
     NODE_ENV=production \
     pnpm --filter api db:migrate:up
   ```

4. Exercise the affected API paths and inspect the transformed data.
5. Delete the Neon branch after verification.

Never rehearse a destructive migration directly against production.

## Nightly backups

`.github/workflows/backup.yml` runs at 03:00 UTC and can also be dispatched
manually. It writes a gzip-compressed logical dump to runner-temporary storage
and uploads it to `gs://<backup-bucket>/nightly/` only after `pg_dump`
succeeds; no dump is stored in GitHub artifacts or the repository. The bucket
deletes objects after 90 days.

Check recent objects:

```bash
gcloud storage ls -l gs://<backup-bucket>/nightly/
```

GitHub reports a failed scheduled workflow by email. Treat any backup failure
as actionable until a later run succeeds.

## Restore drill

Use a disposable local database. Dumps contain personal data, so keep the
download outside the repository and delete it after the drill.

```bash
export RESTORE_DATABASE_URL=postgresql://postgres:postgres@localhost:<port>/kosmos_restore
export DUMP_OBJECT=gs://<backup-bucket>/nightly/<timestamp>.sql.gz

createdb --host localhost --port <port> --username postgres kosmos_restore
gcloud storage cp "$DUMP_OBJECT" /tmp/kosmos-restore.sql.gz
gunzip --stdout /tmp/kosmos-restore.sql.gz |
  psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=on

psql "$RESTORE_DATABASE_URL" --command '\dt'
DATABASE_URL="$RESTORE_DATABASE_URL" pnpm --filter api start
```

Open the app locally and verify representative project, workstream, step, and
note data. Then stop the app and clean up:

```bash
dropdb --host localhost --port <port> --username postgres kosmos_restore
rm /tmp/kosmos-restore.sql.gz
```

First successful restore drill: 2026-08-04, using
`nightly/2026-08-04T13-45-59Z.sql.gz`. The gzip, schema, constraints, and
migration history were verified in disposable Postgres 18 and all local
artifacts were removed afterward. Do not record database contents or
credentials.

## Operational checks

```bash
gcloud run services describe kosmos --region europe-west1
curl --fail https://<service-or-custom-domain>/health
```

If startup exceeds 256 MiB, raise memory to 512 MiB before changing scaling or
database behavior. Keep `min-instances=0` and `max-instances=1`; scale-to-zero
cold starts are an accepted cost trade-off.
