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

## Known context / constraints (added by owner)

- **Existing AWS free-tier account** — treat AWS as a serious option (e.g.
  EC2/Lightsail + RDS for the backend, **S3 + CloudFront** for a static
  frontend; note Fargate/ECS is not free-tier). **Caveat:** the large AWS free
  tier is **12 months only** — price the _after-free-tier_ steady state too,
  since this tool outlives a year. Still compare non-AWS (Fly / Render / Railway
  for the app; Neon / Supabase for Postgres; Cloudflare Pages / Netlify for
  static frontend).
- **Frontend serving strategy — compare the two explicitly, with cost:**
  1. **Single deployable** — Vite _builds_ the SPA to static files; the
     NestJS/Node server serves that build alongside `/api` (one container, one
     origin, no CORS, one deploy). NB: Vite is dev-only — prod serves the
     _build_, never a running Vite.
  2. **Split** — containerised backend + frontend as static assets on a CDN /
     static host (S3+CloudFront, Cloudflare Pages, Netlify). Edge caching,
     independent deploys, often free frontend hosting; costs CORS/subdomain
     setup + two deploy targets.
     Gather facts, trade-offs, and monthly cost for **both**; the choice is a close
     judgment call and is **decided in ticket 06**, not here. Weight simplicity for
     a 2–6 user tool, but note the split option doubles as a cleaner portfolio
     signal.
