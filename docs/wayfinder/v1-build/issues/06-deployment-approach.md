<!-- wayfinder:grilling -->

# Deployment & hosting approach

Type: grilling
Status: resolved
Blocked by: 03

## Question

Given the options from ticket 03, decide how V1 is stood up and shipped.

## Resolution

**Cloud Run + Neon + single deployable.** Both providers have indefinite free
tiers at this traffic level (~$0/mo). Cold starts on Cloud Run (~1–2s) are
acceptable for 2–6 users; removable later with `min-instances=1` (~$10/mo).

### Decisions

- **App host:** Google Cloud Run (scale-to-zero, always-free tier).
- **Database:** Neon (managed vanilla Postgres, scale-to-zero, indefinite free
  tier, built-in connection pooling). Not in GCP but just a connection string —
  no provider lock-in or cross-cloud management burden.
- **Frontend strategy:** Single deployable — Vite builds the SPA to static
  files, NestJS serves them from the same container via `ServeStaticModule`.
  One container, one origin, no CORS, one deploy target.
- **CD pipeline:** Build one Docker image (API + web dist) → push to GHCR →
  `gcloud run deploy`. Migrations run on container start (ADR 0001) — no
  separate migration step.
- **Secrets/env:** Cloud Run native env vars / Secret Manager (free at this
  volume). Covers `DATABASE_URL`, Google OAuth creds, `.env` email allow-list.
- **Custom domain + TLS:** Cloud Run provides automatic HTTPS + custom domain
  mapping at no extra cost.
- **Cost:** ~$0/mo steady state. ~$10/mo if cold starts become annoying.

### Rationale

- AWS was considered (existing account), but every container-native AWS path
  (Fargate ~$25–30/mo with mandatory ALB, Lightsail Containers ~$7/mo + RDS
  ~$12–22/mo after 12-month free tier) costs more and has more moving parts
  than Cloud Run + Neon at this scale.
- Neon over Cloud SQL because Cloud SQL has no standing free tier (~$8–15/mo
  smallest size). Neon is vanilla Postgres with MikroORM compatibility.
- Single deployable over split frontend because CORS, two pipelines, and two
  DNS/TLS setups buy nothing at 2–6 users.
