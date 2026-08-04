#!/usr/bin/env bash
# Provision (or converge) a deployment environment for Kosmos.
#
# Codifies docs/provisioning.md steps 1–8. Idempotent: every resource is
# created only if missing and converged if present, so the script serves both
# a brand-new environment and the wedding-planner → kosmos cutover inside the
# existing project.
#
# Stays manual (see docs/provisioning.md):
#   - billing link + budget alert (step 1), Artifact Registry cleanup policy
#     (step 2, console), Neon project creation (step 6), OAuth origins
#     (step 9), custom domain (step 10).
#
# For the rename cutover: rename the GitHub repository FIRST, then run this
# immediately after. The WIF condition update is atomic — the moment it runs,
# only the new repo slug can mint GCP tokens, so CI is broken exactly between
# the repo rename and this script.
#
# Usage:
#   PROJECT_ID=<gcp-project> GITHUB_REPO=<owner/repo> AR_REPO=<ar-repo> \
#     OAUTH_CLIENT_ID=<client-id> ALLOWED_EMAILS=<a@x,b@y> \
#     deployment/provision.sh [--deploy-image <full-image-ref>]
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
: "${GITHUB_REPO:?set GITHUB_REPO (owner/repo, used for WIF + gh env)}"
: "${AR_REPO:?set AR_REPO (Artifact Registry repo name)}"
: "${OAUTH_CLIENT_ID:?set OAUTH_CLIENT_ID (SPA builds are broken without it)}"
REGION="${REGION:-europe-west1}"
SERVICE="${SERVICE:-kosmos}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-kosmos-runtime}"
DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-github-deployer}"
GH_ENV="${GH_ENV:-production}"
SECRET_NAME="${SECRET_NAME:-database-url}"
BACKUP_BUCKET="${BACKUP_BUCKET:-$PROJECT_ID-backups}"
WIF_POOL="${WIF_POOL:-github}"
WIF_PROVIDER="${WIF_PROVIDER:-github-oidc}"

DEPLOY_IMAGE=""
if [[ $# -gt 0 ]]; then
  if [[ "$1" == "--deploy-image" ]]; then
    DEPLOY_IMAGE="${2:?--deploy-image needs an image ref}"
  else
    echo "Unknown argument: $1" >&2
    exit 1
  fi
fi

RUNTIME_SA="$RUNTIME_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
DEPLOYER_SA="$DEPLOYER_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

log() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

# Scoped per invocation rather than gcloud config so the operator's global
# config is untouched and a wrong PROJECT_ID fails on the first command.
export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

log "APIs"
gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  iamcredentials.googleapis.com sts.googleapis.com \
  secretmanager.googleapis.com storage.googleapis.com

log "Artifact Registry: $AR_REPO"
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" >/dev/null 2>&1 ||
  gcloud artifacts repositories create "$AR_REPO" \
    --repository-format=docker --location="$REGION"
echo "Reminder: set the keep-2/delete-rest cleanup policy in the console (dry-run OFF)."

log "Service accounts"
for sa in "$RUNTIME_SA_NAME:Kosmos Cloud Run runtime" "$DEPLOYER_SA_NAME:GitHub Actions deployer"; do
  name="${sa%%:*}" display="${sa#*:}"
  gcloud iam service-accounts describe "$name@$PROJECT_ID.iam.gserviceaccount.com" >/dev/null 2>&1 ||
    gcloud iam service-accounts create "$name" --display-name="$display"
done

log "Deployer IAM"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/run.admin" --condition=None --quiet >/dev/null
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/artifactregistry.writer" --condition=None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/iam.serviceAccountUser" --quiet >/dev/null

log "Workload Identity Federation (repo: $GITHUB_REPO)"
gcloud iam workload-identity-pools describe "$WIF_POOL" --location=global >/dev/null 2>&1 ||
  gcloud iam workload-identity-pools create "$WIF_POOL" \
    --location=global --display-name="GitHub Actions"
WIF_ARGS=(
  --location=global --workload-identity-pool="$WIF_POOL"
  --issuer-uri="https://token.actions.githubusercontent.com"
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository"
  --attribute-condition="assertion.repository=='$GITHUB_REPO'"
)
if gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --location=global --workload-identity-pool="$WIF_POOL" >/dev/null 2>&1; then
  # Converge the condition — this is the cutover path when the repo slug changes.
  gcloud iam workload-identity-pools providers update-oidc "$WIF_PROVIDER" "${WIF_ARGS[@]}"
else
  gcloud iam workload-identity-pools providers create-oidc "$WIF_PROVIDER" "${WIF_ARGS[@]}"
fi
gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/attribute.repository/$GITHUB_REPO" \
  --quiet >/dev/null
WIF_PROVIDER_NAME=$(gcloud iam workload-identity-pools providers describe "$WIF_PROVIDER" \
  --location=global --workload-identity-pool="$WIF_POOL" --format='value(name)')

log "Backup bucket: gs://$BACKUP_BUCKET"
gcloud storage buckets describe "gs://$BACKUP_BUCKET" >/dev/null 2>&1 ||
  gcloud storage buckets create "gs://$BACKUP_BUCKET" \
    --location="$REGION" --uniform-bucket-level-access
lifecycle=$(mktemp)
printf '%s' '{"rule":[{"action":{"type":"Delete"},"condition":{"age":90}}]}' > "$lifecycle"
gcloud storage buckets update "gs://$BACKUP_BUCKET" --lifecycle-file="$lifecycle"
rm -f "$lifecycle"
gcloud storage buckets add-iam-policy-binding "gs://$BACKUP_BUCKET" \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/storage.objectCreator" --quiet >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$BACKUP_BUCKET" \
  --member="serviceAccount:$DEPLOYER_SA" --role="roles/storage.objectViewer" --quiet >/dev/null

log "Secret: $SECRET_NAME"
if ! gcloud secrets describe "$SECRET_NAME" >/dev/null 2>&1; then
  echo "Paste the direct (non-pooler) Neon connection string, then Enter + Ctrl-D:"
  gcloud secrets create "$SECRET_NAME" --data-file=-
fi
gcloud secrets add-iam-policy-binding "$SECRET_NAME" \
  --member="serviceAccount:$RUNTIME_SA" --role="roles/secretmanager.secretAccessor" --quiet >/dev/null

log "GitHub environment: $GH_ENV on $GITHUB_REPO"
# Create only if absent — a bodyless PUT on an existing environment would
# reset its protection rules.
gh api "repos/$GITHUB_REPO/environments/$GH_ENV" >/dev/null 2>&1 ||
  gh api -X PUT "repos/$GITHUB_REPO/environments/$GH_ENV" >/dev/null
gh variable set GCP_PROJECT_ID   --env "$GH_ENV" -R "$GITHUB_REPO" --body "$PROJECT_ID"
gh variable set GCP_REGION       --env "$GH_ENV" -R "$GITHUB_REPO" --body "$REGION"
gh variable set GCP_WIF_PROVIDER --env "$GH_ENV" -R "$GITHUB_REPO" --body "$WIF_PROVIDER_NAME"
gh variable set GCP_DEPLOYER_SA  --env "$GH_ENV" -R "$GITHUB_REPO" --body "$DEPLOYER_SA"
gh variable set AR_REPO          --env "$GH_ENV" -R "$GITHUB_REPO" --body "$AR_REPO"
gh variable set BACKUP_BUCKET    --env "$GH_ENV" -R "$GITHUB_REPO" --body "$BACKUP_BUCKET"
gh variable set VITE_GOOGLE_CLIENT_ID --env "$GH_ENV" -R "$GITHUB_REPO" --body "$OAUTH_CLIENT_ID"
if ! gh api "repos/$GITHUB_REPO/environments/$GH_ENV/secrets/DATABASE_URL" >/dev/null 2>&1; then
  echo "Set the backup-job secret now: gh secret set DATABASE_URL --env $GH_ENV -R $GITHUB_REPO"
fi

if [[ -n "$DEPLOY_IMAGE" ]]; then
  log "Cloud Run service: $SERVICE"
  : "${ALLOWED_EMAILS:?set ALLOWED_EMAILS for the service deploy}"
  # ^@^ makes @ the list delimiter: ALLOWED_EMAILS is itself comma-separated,
  # which would split into bogus keys under the default comma delimiter.
  gcloud run deploy "$SERVICE" \
    --image "$DEPLOY_IMAGE" \
    --region "$REGION" \
    --service-account "$RUNTIME_SA" \
    --min-instances=0 --max-instances=1 --memory=256Mi --cpu=1 \
    --port=3000 --allow-unauthenticated \
    --set-secrets "DATABASE_URL=$SECRET_NAME:latest" \
    --set-env-vars "^@^NODE_ENV=production@AUTH_CLIENT_ID=$OAUTH_CLIENT_ID@AUTH_OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration@AUTH_ALLOWED_EMAILS=$ALLOWED_EMAILS"
else
  log "Skipping Cloud Run deploy (pass --deploy-image <ref> to create the service)"
fi

# RUN_SERVICE last, and only when the service exists: CD only passes --image,
# so pointing it at a nonexistent service would let it create a broken one
# (default SA, port 8080, no secret).
if gcloud run services describe "$SERVICE" --region "$REGION" >/dev/null 2>&1; then
  gh variable set RUN_SERVICE --env "$GH_ENV" -R "$GITHUB_REPO" --body "$SERVICE"
else
  echo "WARNING: service $SERVICE does not exist yet — RUN_SERVICE left unset."
  echo "Re-run with --deploy-image (or deploy manually) before pointing CD at it."
fi

log "Done"
echo "Manual follow-ups: budget alert, AR cleanup policy, OAuth origins (add the"
echo "service URL), and docs/provisioning.md step 11 verification."
