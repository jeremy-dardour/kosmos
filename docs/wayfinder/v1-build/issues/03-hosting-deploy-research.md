<!-- wayfinder:research -->
# Hosting & deploy options

Type: research
Status: open

## Question

Survey hosting/deploy options for a cost-sensitive, containerized NestJS +
Postgres + React app serving 2–6 users. AFK — compare + document, decide nothing.

Cover:
- **App hosting** — Cloud Run / Fly.io / Render / Railway / a small VPS.
  Container-friendly (migrations run at container start, [ADR 0001](../../adr/0001-migrations-run-on-container-start.md)).
- **Managed Postgres** — Neon / Supabase / Cloud SQL / RDS / provider-bundled.
- **Existing CI** — what the repo's pipeline already does (see README / CI
  config); what's missing for CD.
- **CD/deploy shape** — build image, run migrations, deploy; preview vs. single
  prod.
- **Secrets/env management**, **custom domain + TLS**, and rough **monthly cost**
  at this scale.

Note Jeremy's context: strong on AWS/large-scale but this is a personal,
budget-sensitive, solo project — weight simplicity + cost over sophistication.

Output: a markdown comparison (linked from this ticket). Input to _Deployment &
hosting approach_.
