# Provisioning a production environment

One-time setup of all infrastructure for a deployment environment (GCP +
Neon + GitHub), as decided in
[issue #26](https://github.com/jeremy-dardour/wedding-planner/issues/26).
Day-2 operations (restore, rollback, migration rehearsal) live in the
[deployment runbook](../deployment/README.md); the _why_ behind
these choices is recorded on the issue and in
[docs/specs/v1-tech-design.md](./specs/v1-tech-design.md).

Substitute the `<...>` placeholders; everything else is decided and should
be used as written.

## Prerequisites

- `gcloud` CLI authenticated, `gh` CLI authenticated against this repo
- A Google account with a GCP billing account (activate the full account —
  trial-only billing pauses all resources when the trial ends)
- The Google OAuth client used by the app (client ID is public, not secret)

```bash
export PROJECT_ID=<gcp-project-id>
export REGION=europe-west1
export REPO=jeremy-dardour/wedding-planner
export AR_REPO=<artifact-registry-repo-name>
```

## 1. GCP project

```bash
gcloud projects create $PROJECT_ID   # or reuse an existing one
gcloud config set project $PROJECT_ID
gcloud billing projects link $PROJECT_ID --billing-account=<billing-account-id>
export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com
```

Guardrail: create a small budget alert on the billing account (e.g. €5/mo,
thresholds 50/90/100%, credits/promotions excluded so gross usage alerts
early). Billing console → Budgets & alerts.

## 2. Artifact Registry

Settings that deviate from console defaults are deliberate:
Google-managed encryption (no CMEK), **mutable** tags (CD pushes a moving
`latest` alongside unique `git-<sha>` tags), **vulnerability scanning off**
(≈$0.26 per pushed image; `docker scout cves` / `trivy image` cover the
need on demand for free), platform logs left at default.

```bash
gcloud artifacts repositories create $AR_REPO \
  --repository-format=docker --location=$REGION
```

Cleanup policy (stays under the 0.5 GB free tier): a **Keep** policy for
the 2 most recent versions + a **Delete** policy for everything else, with
dry-run **disabled** (console leaves it on, which never deletes anything).

## 3. Service accounts

Two accounts, least privilege:

| Account                   | Purpose                                 | Permissions                                                                                                                                 |
| ------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `wedding-planner-runtime` | Cloud Run workload identity             | `secretmanager.secretAccessor` on the `database-url` secret only (step 6)                                                                   |
| `github-deployer`         | CI: push images, deploy, upload backups | `run.admin` + `artifactregistry.writer` (project), `iam.serviceAccountUser` on the runtime SA, `storage.objectCreator` on the backup bucket |

The runtime SA deliberately has nothing else: the app's database is
external (Neon) and Cloud Run captures logs/metrics without IAM grants, so
a fully compromised container yields only the database URL it already
holds.

```bash
gcloud iam service-accounts create wedding-planner-runtime --display-name="Cloud Run runtime"
gcloud iam service-accounts create github-deployer --display-name="GitHub Actions deployer"
export RUNTIME_SA=wedding-planner-runtime@$PROJECT_ID.iam.gserviceaccount.com
export DEPLOYER_SA=github-deployer@$PROJECT_ID.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/artifactregistry.writer"
gcloud iam service-accounts add-iam-policy-binding $RUNTIME_SA \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/iam.serviceAccountUser"
```

## 4. Workload Identity Federation (CI → GCP, keyless)

No service-account keys anywhere. The provider is restricted to this
GitHub repository.

```bash
gcloud iam workload-identity-pools create github \
  --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-oidc \
  --location=global --workload-identity-pool=github \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='jeremy-dardour/wedding-planner'"

gcloud iam service-accounts add-iam-policy-binding $DEPLOYER_SA \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/jeremy-dardour/wedding-planner"

# Provider resource name — needed as a GitHub variable in step 7
gcloud iam workload-identity-pools providers describe github-oidc \
  --location=global --workload-identity-pool=github --format='value(name)'
```

## 5. Backup bucket

Private bucket for nightly `pg_dump` files. Dumps contain personal data —
they must never be stored in the repo, GitHub artifacts, or any
repo-adjacent location.

```bash
gcloud storage buckets create gs://$PROJECT_ID-backups \
  --location=$REGION --uniform-bucket-level-access

printf '%s' '{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}' > /tmp/lifecycle.json
gcloud storage buckets update gs://$PROJECT_ID-backups --lifecycle-file=/tmp/lifecycle.json

# CI may only create objects — it cannot read or delete existing dumps
gcloud storage buckets add-iam-policy-binding gs://$PROJECT_ID-backups \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/storage.objectCreator"
```

## 6. Neon database

- Project in **AWS `eu-central-1`** (same metro as `europe-west1` —
  cross-cloud latency stays single-digit ms), Postgres major version
  matching local/CI (`postgres:18`).
- Neon Auth **off** — the app has its own Google auth.
- Use the **direct** connection string everywhere (hostname _without_
  `-pooler`): Neon's pooled endpoint is transaction-mode PgBouncer, which
  breaks migration runners, and with `max-instances=1` pooling buys
  nothing.
- Defaults otherwise (5-min autosuspend is part of the accepted cold-start
  trade-off).

Store the string in Secret Manager — run, paste the string, Enter, Ctrl-D
(keeps it out of shell history):

```bash
gcloud secrets create database-url --data-file=-

gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor"
```

## 7. GitHub environment

Secrets and variables live in a repo **Environment** named `production`;
the CD and backup workflows declare `environment: production` to read
them.

Secret (paste interactively, don't inline in the command):

```bash
gh secret set DATABASE_URL --env production -R $REPO   # direct Neon URL, for the backup job
```

Variables:

```bash
gh variable set GCP_PROJECT_ID   --env production -R $REPO --body "$PROJECT_ID"
gh variable set GCP_REGION       --env production -R $REPO --body "$REGION"
gh variable set GCP_WIF_PROVIDER --env production -R $REPO --body "<provider-name-from-step-4>"
gh variable set GCP_DEPLOYER_SA  --env production -R $REPO --body "$DEPLOYER_SA"
gh variable set AR_REPO          --env production -R $REPO --body "$AR_REPO"
gh variable set RUN_SERVICE      --env production -R $REPO --body "wedding-planner"
gh variable set BACKUP_BUCKET    --env production -R $REPO --body "$PROJECT_ID-backups"
gh variable set VITE_GOOGLE_CLIENT_ID --env production -R $REPO --body "<oauth-client-id>"
```

## 8. First deploy (manual, once)

CI only ever updates the image on an existing service; the service itself
is created and configured here. Build and push a Linux AMD64 image first (use
`docker build --platform linux/amd64` when building on Apple Silicon), then:

```bash
gcloud run deploy wedding-planner \
  --image $REGION-docker.pkg.dev/$PROJECT_ID/$AR_REPO/app:<tag> \
  --region $REGION \
  --service-account $RUNTIME_SA \
  --min-instances=0 --max-instances=1 --memory=256Mi --cpu=1 \
  --port=3000 --allow-unauthenticated \
  --set-secrets DATABASE_URL=database-url:latest \
  --set-env-vars NODE_ENV=production,AUTH_CLIENT_ID=<oauth-client-id>,AUTH_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration,AUTH_ALLOWED_EMAILS=<comma-separated-emails>
```

- `--allow-unauthenticated` is intentional: auth is app-level (Google
  sign-in + allow-list); Cloud Run IAM must not gate the browser.
- `--max-instances=1` caps cost, bounds Neon connections, and prevents two
  containers racing `migration:up` at start.
- If the container OOMs at startup, bump `--memory=512Mi` (still within
  the free tier) before changing anything else.
- Migrations run at container start ([ADR 0001](./adr/0001-migrations-run-on-container-start.md));
  scale-to-zero means every cold start re-checks them — accepted.

## 9. OAuth origins

In the Google Cloud OAuth console, add to **Authorized JavaScript
origins** of the existing client: the service's `*.run.app` URL and (after
step 10) the custom domain. Verify sign-in works for every allow-listed
account.

## 10. Custom domain

```bash
gcloud run domain-mappings create --service wedding-planner \
  --domain <domain> --region $REGION
```

Add the DNS records it prints at the registrar; TLS provisions
automatically. Domain mapping is a long-standing preview feature — if it
misbehaves, the free fallback is a Cloudflare DNS proxy in front of the
`run.app` URL, not a GCP load balancer.

## 11. Verify

```bash
gcloud secrets versions list database-url                  # one enabled version
gh variable list --env production -R $REPO                 # 8 variables
curl -s https://<domain>/health                            # health JSON
curl -s https://<domain>/ | head -3                        # SPA index.html
curl -s https://<domain>/api/projects -o /dev/null -w '%{content_type}\n'  # JSON, not html
```

Then confirm: a merge to `main` deploys automatically; the nightly backup
workflow puts a dump in the bucket; one dump has been restored locally
(see the runbook's restore drill). Bootstrap the initial Project row
(`POST /api/projects`, authenticated) — the UI has no create affordance
for the first project.
