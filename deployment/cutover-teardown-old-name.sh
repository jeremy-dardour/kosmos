#!/usr/bin/env bash
# TEMPORARY — delete the pre-rename (wedding-planner) resources after the
# Kosmos cutover is verified. Delete this script once it has run.
#
# Removes, in the existing GCP project:
#   - the old Cloud Run service            (wedding-planner)
#   - the old runtime service account      (wedding-planner-runtime)
#   - the deployer's WIF binding for the old repo slug (already inert once
#     provision.sh flipped the provider condition — removed here as hygiene)
#
# Shared resources stay: Artifact Registry repo, backup bucket, database-url
# secret, WIF pool/provider (its condition is converged by provision.sh),
# github-deployer SA. The OAuth consent screen and old authorized origin are
# console-managed — remove the old origin by hand (provisioning guide step 9).
#
# Usage: PROJECT_ID=<gcp-project> deployment/cutover-teardown-old-name.sh
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-europe-west1}"
OLD_SERVICE="${OLD_SERVICE:-wedding-planner}"
OLD_RUNTIME_SA_NAME="${OLD_RUNTIME_SA_NAME:-wedding-planner-runtime}"
OLD_GITHUB_REPO="${OLD_GITHUB_REPO:-jeremy-dardour/wedding-planner}"
DEPLOYER_SA_NAME="${DEPLOYER_SA_NAME:-github-deployer}"
WIF_POOL="${WIF_POOL:-github}"
SECRET_NAME="${SECRET_NAME:-database-url}"

OLD_RUNTIME_SA="$OLD_RUNTIME_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
DEPLOYER_SA="$DEPLOYER_SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"

export CLOUDSDK_CORE_PROJECT="$PROJECT_ID"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')

echo "About to delete from project $PROJECT_ID:"
echo "  - Cloud Run service   $OLD_SERVICE ($REGION)"
echo "  - Service account     $OLD_RUNTIME_SA"
echo "  - WIF binding for     $OLD_GITHUB_REPO on $DEPLOYER_SA"
echo
echo "Run this only after the kosmos service is verified (deploy, sign-in,"
echo "data, backups). There is no undo."
read -r -p "Type '$OLD_SERVICE' to confirm: " answer || { echo "No TTY — aborted."; exit 1; }
[[ "$answer" == "$OLD_SERVICE" ]] || { echo "Aborted."; exit 1; }

if gcloud run services describe "$OLD_SERVICE" --region "$REGION" >/dev/null 2>&1; then
  gcloud run services delete "$OLD_SERVICE" --region "$REGION" --quiet
else
  echo "Cloud Run service $OLD_SERVICE already gone."
fi

if gcloud iam service-accounts describe "$OLD_RUNTIME_SA" >/dev/null 2>&1; then
  # Drop its secret access first so the secret's policy holds no dead member.
  gcloud secrets remove-iam-policy-binding "$SECRET_NAME" \
    --member="serviceAccount:$OLD_RUNTIME_SA" \
    --role="roles/secretmanager.secretAccessor" --quiet >/dev/null 2>&1 || true
  gcloud iam service-accounts delete "$OLD_RUNTIME_SA" --quiet
else
  echo "Service account $OLD_RUNTIME_SA already gone."
fi

gcloud iam service-accounts remove-iam-policy-binding "$DEPLOYER_SA" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$WIF_POOL/attribute.repository/$OLD_GITHUB_REPO" \
  --quiet >/dev/null 2>&1 || echo "Old WIF binding already gone."

echo
echo "Done. Manual: remove the old service's origin from the OAuth client and"
echo "rename the consent-screen application. Then delete this script."
