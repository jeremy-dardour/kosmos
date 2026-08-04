# Hosting & Deploy Research

**Date:** 2026-07-19
**Scope:** Hosting/CD options for the wedding-planner app — a containerized
NestJS API + React SPA, Postgres-backed, 2–6 users, minimal traffic, solo dev,
cost-sensitive. Migrations run at container start ([ADR 0001](../adr/0001-migrations-run-on-container-start.md)).

This is options research, not a decision. It doesn't pick a stack — see
[docs/current-state.md](../current-state.md) for whether a hosting decision has
since been made and recorded (as an ADR, per convention).

---

## 1. Existing CI pipeline — what's there, what's missing for CD

Read from `.github/workflows/ci.yml`, `.github/actions/ci-setup/action.yml`,
`deployment/Dockerfile`, `deployment/entrypoint.app.sh`, and
`docker-compose.yml`.

**What CI already does** (all on PR + push to `main`/`ci/**`, no deploy trigger):

- **Quality gates**: format check, dependency check (`pnpm dependencies:check`),
  `check-types`, `lint` — each a separate fast job.
- **API contract check**: spins up a real `postgres:18` service container, runs
  migrations, boots the API, hits `/openapi.yaml`, regenerates
  `packages/api-contracts/src/openapi.d.ts`, and fails the build if the checked-in
  types drift from the live API.
- **Unit tests**: matrix over API and web, with coverage uploaded as artifacts.
- **API E2E tests**: real Postgres service container, migrations, `test:cov:e2e`.
- **Coverage report**: merges API unit+E2E coverage, diffs against a cached
  `main` baseline, comments on PRs.
- **Web E2E (Playwright)**: builds the Vite app in e2e mode, serves it with
  `vite preview`, runs Playwright against it headless.

**What's missing for CD** — there is currently **no CD at all**:

- No workflow builds or pushes a container image (the `Dockerfile` under
  `deployment/` is never invoked by CI — it's only used for local
  `docker-compose --profile api-local-container up`).
- No image registry target (no GHCR/ECR/Docker Hub push step).
- No deploy step to any host, and no environment/secrets wiring for one.
- No `Dockerfile` for the web app at all — the web build in CI only exists to
  run Playwright against a `vite preview` static server, not to ship it.
- Migrations-on-start is already deploy-ready per ADR 0001 (the entrypoint
  runs `mikro-orm migration:up` unconditionally before `node .../main.js`), so
  whatever CD is added doesn't need a separate migration step — the container
  does it.

**Implication:** adding CD is additive, not a rework — one new job that builds
the image(s) CI already validates and ships them somewhere. The main open
question CD needs answered is _where_, which is what the rest of this doc is
about, and _whether the web app becomes a container at all_ (single-deployable
vs. split — see §4).

---

## 2. App hosting options (containerized NestJS API + Postgres)

| Option                                    | Free tier                                                                                                                                                                                                                | Monthly cost at this scale                                                                                                                                                                                                                | Container support                                                                                               | Deploy ease                                                                                                             | Managed SSL / custom domain                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Cloud Run** (GCP)                       | 2M requests, 360k GB-seconds / 180k vCPU-seconds, 1M vCPU-seconds, 5 GB egress — **always free**, not time-limited                                                                                                       | **~$0–2/mo** scale-to-zero with cold starts; **~$10–15/mo** with `min-instances=1` to avoid them                                                                                                                                          | Native (any OCI image)                                                                                          | `gcloud run deploy`, or GitHub Action; no load balancer to provision                                                    | Yes, automatic HTTPS + custom domain mapping, no extra cost                                  |
| **Fly.io**                                | No free plan for new orgs since 2025 (legacy orgs on old plans keep a small grandfathered allowance)                                                                                                                     | `shared-cpu-1x`/256MB machine ≈ **$2/mo** compute; realistic api+db footprint (1x 256–512MB app + Fly Postgres, see §3) lands **~$5–10/mo** for the app machine alone                                                                     | Native (`fly launch`, Machines API)                                                                             | `fly deploy` from a Dockerfile; very fast, good DX                                                                      | Yes, automatic HTTPS via `fly certs`, custom domains free                                    |
| **Render**                                | Free web service: 750 instance-hours/mo shared across the workspace, but **spins down after 15 min idle** (30–60s cold start on wake) — usable for a demo, not for "always on for 2–6 people checking a wedding tracker" | **Starter $7/mo** (512MB RAM, no sleep) is the realistic tier                                                                                                                                                                             | Native, Dockerfile or native runtime                                                                            | Git-push deploy, very low friction                                                                                      | Yes, free TLS + custom domains on paid tiers                                                 |
| **Railway**                               | $5 one-time trial credit, no ongoing free tier                                                                                                                                                                           | **Hobby plan $5/mo** includes usage allowance, then usage-based (CPU/mem/GB-second); realistic small API **~$5–10/mo**                                                                                                                    | Native, Dockerfile or Nixpacks                                                                                  | Git-push deploy, very good DX, one of the fastest to first deploy                                                       | Yes, free TLS + custom domains                                                               |
| **AWS EC2 (t3.micro) / Lightsail**        | EC2: 750 hrs/mo t2/t3.micro for **12 months only**. Lightsail: smallest instance **$5/mo** (0.5GB/2vCPU/1TB transfer), 3-month free trial, then billed; Lightsail **Containers** from **$7/mo** (nano, 0.25 vCPU/512MB)  | EC2 after free tier: **~$8–9/mo** (t3.micro on-demand) + EBS. Lightsail: **$5–7/mo** flat, predictable, includes bandwidth                                                                                                                | Needs self-managed Docker on EC2; Lightsail Containers is a managed container service (closer to Cloud Run/Fly) | EC2: you own the box (systemd/docker-compose, patching). Lightsail Containers: `lightsailctl` push, closer to PaaS ease | Both: DIY (Caddy/nginx + Let's Encrypt, or Lightsail's built-in cert manager for Containers) |
| **AWS ECS/Fargate**                       | **Not free-tier eligible**                                                                                                                                                                                               | Fargate task alone (0.25 vCPU/0.5GB, 24/7): **~$7–9/mo**. **Add an ALB: +$16–20/mo minimum** (flat hourly rate regardless of traffic) since Fargate services normally sit behind one → **realistic floor ~$25–30/mo**                     | Native (task definitions), most "enterprise" of the options                                                     | Heaviest setup: task defs, service, target group, ALB listener rules, IAM roles; typically Terraform/CDK to keep sane   | Yes via ACM + ALB, but that's exactly the extra cost/complexity driver                       |
| **Small VPS** (Hetzner CX22 / DO Droplet) | DO gives new-signup credit (~$5, 90-day expiry); Hetzner has no free tier                                                                                                                                                | Hetzner CX22: **~€3.8–4.6/mo** (2 vCPU/4GB/40GB, 20TB traffic included). DO smallest: **$4/mo** (1 vCPU/512MB/10GB, 500GB traffic) — likely too small for API+Postgres together; a $6–12/mo droplet is more realistic for both on one box | You run Docker/docker-compose yourself — full control, full ops burden                                          | Manual (SSH + docker-compose, or a script/Ansible); no built-in CD hook                                                 | DIY — Caddy (auto Let's Encrypt) makes this nearly free effort-wise                          |

**Reading this for the project's scale:** Cloud Run and Fly.io are the two
that combine "genuinely cheap at this traffic" with "no infra to babysit."
Cloud Run's always-free tier (not time-limited, unlike AWS) is the standout —
at 2–6 users hitting the app occasionally, this plausibly runs **$0/mo**
indefinitely if cold starts (a few hundred ms to ~1–2s for a small Node
image) are acceptable; â‰ˆ$10/mo buys that away with `min-instances=1`. Fargate's
mandatory ALB tax makes it the most expensive containerized option here
despite AWS being the account the owner already has — Lightsail Containers is
the more scale-appropriate AWS-native option if staying in AWS matters.

---

## 3. Managed Postgres options

| Option                     | Free tier                                                                                                                                          | Cost after free tier                                                                                                                                                                                                        | Connection limits                                                                                       | Backups                                                                                  | Setup                                                                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon**                   | 0.5 GB storage, 100 compute-hours/mo per project, up to 10 branches, autosuspend after 5 min idle (scale-to-zero, $0 while suspended), 5 GB egress | Launch tier: **$0.106/CU-hour** compute + **$0.35/GB-mo** storage, pay-as-you-go beyond that; a tiny always-idle app likely stays **near $0–5/mo** even off free tier given autosuspend                                     | Built-in PgBouncer connection pooling on all tiers                                                      | Point-in-time restore via branching (history window 6h/1GB on free tier, longer on paid) | Fastest of the bunch — one connection string, works with any Postgres client/ORM immediately                                                                                                                                                                                                 |
| **Supabase**               | 500 MB DB, shared CPU, **pauses after 1 week inactivity** (2 active free projects/org limit)                                                       | Pro plan **$25/mo flat**, includes $10/mo compute credit (covers one Micro instance), 8GB disk, 250GB egress                                                                                                                | PgBouncer pooling included on paid tiers, connection counts scale with compute size (Micro: 200 pooled) | Daily backups, 7-day retention on Pro                                                    | Easy, but brings a lot of platform (auth/storage/realtime) the project doesn't need — plain Postgres use is a bit of overkill                                                                                                                                                                |
| **CockroachDB Serverless** | $15/mo free credit ≈ 50M Request Units + 10 GiB storage, **always free at this scale** (10 GiB is generous for a wedding tracker)                  | ~$0.20/million RUs + $0.50/GiB-mo beyond credit                                                                                                                                                                             | Standard Postgres-wire connection limits, pooling via built-in load balancing                           | Automated backups included                                                               | Postgres-compatible wire protocol but **not vanilla Postgres** (distributed SQL) — some Postgres-specific features/extensions may not apply; worth a compatibility check against MikroORM's Postgres driver before committing                                                                |
| **PlanetScale (Postgres)** | **None** — Hobby/free tier removed April 2024, not reinstated                                                                                      | Single-node Postgres from **$5/mo**; production HA (3-node) from **$15/mo**                                                                                                                                                 | Standard                                                                                                | Included on paid plans                                                                   | Not a free option anymore; only worth it if already using PlanetScale for something else                                                                                                                                                                                                     |
| **Cloud SQL (GCP)**        | No standing free tier (GCP's general free-trial credit can cover it briefly)                                                                       | Smallest shared-core tier (`db-f1-micro`/`db-g1-small` equivalent) **~$8–15/mo** depending on region + ~$0.17–0.20/GB-mo storage — cheapest realistic always-on tier is still noticeably more than serverless options above | Configurable, standard Postgres limits                                                                  | Automated backups + PITR, easy toggle                                                    | Pairs naturally with Cloud Run (same project, private IP or Cloud SQL Auth Proxy) — the main reason to pick it over Neon if going all-in on GCP                                                                                                                                              |
| **RDS (AWS)**              | `db.t4g.micro`/`db.t3.micro`, 20GB storage, 20GB backup — **free for 12 months** on eligible new accounts only                                     | `db.t4g.micro` on-demand **~$12–22/mo** depending on region (roughly $0.016–0.03/hr) + storage                                                                                                                              | Standard, instance-size-dependent                                                                       | Automated backups configurable, PITR available                                           | Straightforward if already in AWS (matches EC2/ECS/Lightsail choice), but the always-on instance is the priciest "traditional" managed option here once free tier lapses                                                                                                                     |
| **Fly Postgres (Managed)** | None                                                                                                                                               | Cheapest managed plan (**Basic**, shared-2x/1GB) is **$38/mo** + $0.28/GB-mo storage — **much pricier than it looks for this scale**                                                                                        | Built-in pooling, HA on higher tiers                                                                    | Automated                                                                                | Tightly integrated if already on Fly, but Fly's _unmanaged_ single-node Postgres app (self-run, not "Managed Postgres") is the cheap path on Fly — roughly one more `shared-cpu-1x`/256MB machine (~$2/mo) plus a small volume, at the cost of running Postgres yourself (backups, upgrades) |
| **Railway Postgres**       | $5 one-time trial credit                                                                                                                           | Usage-based: storage **~$0.25–0.35/GB-mo** + compute/memory-second charges on top of the Hobby plan's $5/mo base; typical small Postgres reported **$10–40/mo** depending on sizing                                         | Standard                                                                                                | Automated volume snapshots                                                               | Provisions in one click alongside the API service, same billing/usage model as the app — simplest "everything in one dashboard" option                                                                                                                                                       |
| **Render Postgres**        | 1 GB, **expires 30 days after creation** (14-day grace period post-expiry, then deleted) — free tier is a trial, not a durable option              | Starter **$6/mo** (1 GB)                                                                                                                                                                                                    | Standard, tier-dependent                                                                                | Automated daily backups on paid tiers                                                    | Matches Render's app hosting for a fully single-vendor setup                                                                                                                                                                                                                                 |

**Reading this for the project's scale:** Neon and CockroachDB Serverless are
the two real "stays near $0 indefinitely" options because both scale-to-zero
or credit-cover this workload's traffic. Neon is the more conventional choice
(vanilla Postgres, mature Node/TypeORM/MikroORM ecosystem support); CockroachDB
Serverless is worth flagging as a curiosity but its distributed-SQL model is a
bigger behavioral departure from plain Postgres than this project needs.
Provider-bundled Postgres (Fly Managed, Railway, Render) is the "convenience
premium" tier — fine if minimizing the number of dashboards matters more than
minimizing cost, but none of them are free indefinitely, unlike Neon.

---

## 4. Frontend serving strategy

### Option A — Single deployable (NestJS serves the built SPA)

Vite builds the SPA to static files at build time (`vite build`); those
files are copied into the API's container image and served by Express
(NestJS's underlying HTTP layer) alongside `/api/*`, e.g. via
`ServeStaticModule` or a manual static-file middleware. **Vite itself never
runs in production** — it's a dev-time/build-time tool only; the prod
artifact is plain static HTML/JS/CSS files that any Node static-file server
can serve. One container, one origin, no CORS, one deploy target, one URL to
manage TLS/DNS for.

- **Cost:** $0 incremental — it's the same container the API already needs;
  no second hosting bill.
- **Complexity:** Low. One `Dockerfile` builds both `apps/web` and
  `apps/api`, copies the web `dist/` into the API image (or a shared volume),
  and the Nest app serves it as a fallback route. No CORS config, no second
  DNS/SSL setup, no cross-origin auth cookie complications (relevant since the
  app uses Google OAuth — same-origin cookies are simpler than cross-origin).
- **Deploy story:** One image, one deploy step, one place migrations +
  static assets + API all roll together atomically. Matches ADR 0001's
  "fork-and-go" philosophy — the whole app is one artifact.
- **Trade-off:** No CDN edge caching for static assets (they're served from
  wherever the API container runs); at 2–6 users this is irrelevant —
  there's no meaningful latency or bandwidth cost difference at this traffic
  level. Slightly bigger container image (bundles both builds).
- **Portfolio signal:** Reads as "knows how to ship a real fullstack app
  simply" — not a knock against sophistication, since the reasoning ("no
  CORS, one deploy, matches project scale") is itself the interesting
  engineering signal for an interview, especially paired with the ADR 0001
  reasoning about deploy simplicity.

### Option B — Split (containerized API + frontend on a CDN/static host)

The web build ships to a static host (S3+CloudFront, Cloudflare Pages,
Netlify, or Vercel); the API stays a separate container elsewhere. Two
deploy targets, two origins, requires CORS configuration and a decision about
where auth cookies/tokens live (cross-origin cookie handling needs
`SameSite=None; Secure`, or a token-based auth flow instead).

| Static host          | Free tier                                                                                                                                                                                                                                           | Custom domain + SSL                                         | Notes                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cloudflare Pages** | Unlimited bandwidth/requests, 500 builds/mo, 100 custom domains — genuinely free indefinitely at this scale                                                                                                                                         | Yes, free                                                   | Best free-tier ceiling of the four; edge network is global                                                                                                   |
| **Netlify**          | 300 build/bandwidth "credits"/mo (~15 production deploys, ~15GB @ $0.13/GB-equiv bandwidth) before metered charges                                                                                                                                  | Yes, free                                                   | Fine at this traffic; the credit model just means watch usage if deploys are frequent                                                                        |
| **Vercel**           | 100GB fast data transfer/mo, 1M edge requests/mo, unlimited deployments                                                                                                                                                                             | Yes, free (Hobby)                                           | Generous for a project this size; Hobby plan is non-commercial-use licensed                                                                                  |
| **S3 + CloudFront**  | AWS general free tier: 5GB S3 storage, 1TB CloudFront transfer, 10M CloudFront requests/mo for 12 months, then pay-as-you-go (pennies/mo at this traffic — S3 storage for a SPA build is a few MB, CloudFront transfer for 2–6 users is negligible) | Yes, via ACM (free cert) + Route 53 (~$0.50/mo hosted zone) | Cheapest indefinitely (~$0.50–1/mo after free tier) but the most manual setup: bucket policy, OAC/OAI, CloudFront distribution, cache invalidation on deploy |

- **Cost:** All four options are effectively **$0/mo** at 2–6 users'
  traffic (S3+CloudFront ~$0.50/mo for the Route 53 zone if a custom domain
  is wanted). This is the strategy's genuine advantage — frontend hosting is
  free regardless of which CDN is picked.
- **Complexity:** Higher than Option A — two deploy pipelines to maintain,
  CORS headers on the API, environment-specific API base URLs baked into the
  frontend build, and (if using cookie-based auth) same-site cookie
  workarounds or a token-based auth scheme instead.
- **Deploy story:** Independent deploys are a real benefit for a team, but
  for a solo dev shipping both together every time, it's two things to keep
  in sync (API URL config, CORS allow-list, coordinated releases) rather than
  one atomic deploy.
- **Portfolio signal:** Demonstrates CDN/edge familiarity and is the more
  "expected" pattern for a split SPA+API architecture — but for a 2-person
  personal tool, choosing it _because it's more standard_ rather than because
  it's needed is exactly the over-architecture instinct worth watching for
  here (matches the known EM-background bias toward more infra than the
  problem calls for).

**Verdict for this project's scale:** Option A (single deployable) is the
better fit — zero incremental hosting cost either way, but it removes a whole
axis of complexity (CORS, cross-origin cookies, two deploy pipelines, two
DNS/TLS setups) that split-frontend buys nothing for at 2–6 users. It also
means whichever app-hosting choice from §2 is made, the web app rides along
for free in the same container — no separate frontend hosting decision
needed at all.

---

## 5. CD/deploy shape

A minimal CD pipeline for this app, regardless of which host is chosen:

1. **Build** — `docker build` the (single, per §4) image from
   `deployment/Dockerfile` (extended to also build+copy the web
   app's `dist/`), tagged with the git SHA.
2. **Push** — push to a registry: GHCR (free, zero setup, lives next to the
   repo) is the natural default over ECR/Artifact Registry/Docker Hub unless
   the chosen host requires its own registry (Cloud Run needs Artifact
   Registry or GHCR-via-mirror; Fly/Railway/Render pull from their own
   build or accept a registry image directly).
3. **Migrate** — **nothing extra to add**: the entrypoint already runs
   `mikro-orm migration:up` on container start (ADR 0001), so "deploy the new
   image" and "migrate" are the same step. This is the main reason CD stays
   simple here — no separate migration job, no ordering problem between
   "migrate" and "roll the app."
4. **Deploy** — trigger the host's deploy mechanism: `gcloud run deploy
--image ...` (Cloud Run), `fly deploy` (Fly), a registry webhook (Render/
   Railway), or `docker compose pull && up -d` over SSH (VPS). All of these
   can be one GitHub Actions job gated on the existing `ci.yml` jobs passing,
   triggered on push to `main`.

**Preview environments vs. single prod:** Not worth it here. Preview
environments earn their cost on teams reviewing PRs against live
infrastructure; for a solo dev with 2–6 end users and a `main`-only branch
strategy already reflected in `ci.yml` (`branches: [main]`), a single prod
environment deployed on every merge to `main` is the appropriate scope. If
schema-breaking changes ever need testing before prod, a manually-triggered
deploy to a second cheap instance (same host, second Cloud Run
service/Fly app) is simpler than standing up ephemeral preview infra.

**Secrets/env management:** Given the scale, host-native secret storage is
enough — no need for a dedicated secrets manager (Vault, AWS Secrets
Manager):

- Cloud Run: secrets as env vars or mounted from Secret Manager (free tier
  covers this volume trivially).
- Fly: `fly secrets set` (encrypted, injected as env vars at boot).
- Render/Railway: dashboard-managed env vars per service.
- VPS: `.env` file outside the repo, referenced by `docker-compose`
  (matches the existing local pattern — `apps/api/.env.docker.local` per
  `docker-compose.yml` — just needs the same discipline in prod).

The required vars are already known from CI (`DATABASE_URL`, `NODE_ENV`,
auth-related `AUTH_CLIENT_ID` / `AUTH_OIDC_DISCOVERY_URL` /
`AUTH_ACCEPTED_SCOPES` per `ci.yml`'s api-contract-check job) — CD just needs
those set as real (non-fake) values on whichever host is chosen.

---

## 6. Summary comparison table

Rows combine one app host + one Postgres + the frontend strategy from §4
(single deployable assumed unless noted, since it's free regardless of host).

| Combo                                                                          | Monthly cost (steady state)                                                             | Complexity                                                                         | Cold starts                                                                | Free tier duration                                                   | Deploy ease                                                                      |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **Cloud Run + Neon + single deployable**                                       | **~$0–5/mo** (both providers' always-free tiers realistically cover this traffic)       | Low                                                                                | Yes, unless `min-instances=1` (~+$10/mo removes them)                      | **Indefinite** — neither tier is time-limited                        | High — `gcloud run deploy`, no servers                                           |
| **Fly.io + Neon + single deployable**                                          | **~$2–7/mo** (Fly machine, no free plan) + Neon ~$0                                     | Low                                                                                | Minimal (Fly machines can stay warm cheaply; not scale-to-zero by default) | Neon indefinite; Fly has no free tier                                | High — `fly deploy`, great DX                                                    |
| **Fly.io + Fly Postgres (self-run, not Managed) + single deployable**          | **~$4–8/mo** (2 small machines)                                                         | Low-medium (own Postgres backups)                                                  | Minimal                                                                    | No free tier                                                         | High                                                                             |
| **Railway + Railway Postgres + single deployable**                             | **~$10–20/mo** (Hobby base + usage-based DB)                                            | Low                                                                                | Minimal                                                                    | $5 one-time credit only                                              | Highest — single dashboard, git-push deploy                                      |
| **Render + Render Postgres + single deployable**                               | **~$13/mo** ($7 web + $6 DB Starter), or $0 briefly on free tiers that spin down/expire | Low                                                                                | Free-tier web service sleeps (30–60s wake); Starter tier doesn't           | Free tier exists but web sleeps, DB expires in 30 days — not durable | High — git-push deploy                                                           |
| **Cloud Run + Cloud SQL + split frontend (Cloudflare Pages)**                  | **~$8–17/mo** (Cloud SQL smallest tier dominates; Cloud Run + Pages ~$0)                | Medium (CORS, 2 deploy targets, Cloud SQL networking)                              | Cloud Run: same as above                                                   | Cloud SQL: no standing free tier                                     | Medium — two pipelines                                                           |
| **AWS Lightsail Containers + RDS + single deployable**                         | **~$7 (container) + $12–22 (RDS after 12mo) ≈ $20–30/mo**                               | Medium (still AWS IAM/networking basics)                                           | Minimal (always-on container)                                              | 12 months only (RDS + general EC2-family free tier), then full price | Medium                                                                           |
| **AWS ECS/Fargate + RDS + split frontend (S3+CloudFront)**                     | **~$25–30 (Fargate+ALB) + $12–22 (RDS) + ~$1 (S3/CF) ≈ $40–55/mo**                      | High (task defs, ALB, target groups, IAM, S3 bucket policy, CF distribution, CORS) | Minimal                                                                    | 12 months on RDS only; Fargate/ALB never free                        | Low — most moving parts of any combo here                                        |
| **Hetzner/DO VPS + self-hosted Postgres (docker-compose) + single deployable** | **~$4–12/mo flat** (one box running both containers)                                    | Medium (own the OS, patching, backups, TLS via Caddy, no managed anything)         | None (always-on)                                                           | No free tier (DO has a small signup credit)                          | Low-medium — manual SSH deploy or a simple script/webhook; no PaaS deploy button |

**Headline takeaway:** Cloud Run + Neon + single deployable is the strongest
fit for this project's stated constraints (cost-sensitive, solo dev, 2–6
users, containers, no ops appetite) — both halves have an _indefinite_ free
tier at this traffic level, not a 12-month clock like the AWS options, and
the single-deployable frontend removes a whole category of setup (CORS,
second DNS/TLS, two pipelines) for zero cost. The AWS free-tier account is
real and worth using for learning/portfolio AWS exposure, but every
container-native AWS path here (Fargate especially) is pricier and more
moving-parts than the GCP/Fly equivalents once judged on this project's
actual scale rather than "enterprise-readiness" — the over-architecture
instinct flagged in the owner's background notes is the thing to watch for
in this specific decision.

---

## Sources

Pricing pulled from provider pricing pages and current (2026) aggregator/
review sources via web search on 2026-07-19; provider pricing pages are
primary, aggregator figures are cross-checked but should be re-verified
against the provider's own page before a final decision, since third-party
pricing sites are noted (in-line above) to sometimes lag or misreport
(e.g. PlanetScale's removed free tier still shows as "free" on some
aggregators).

- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Fly.io pricing](https://fly.io/docs/about/pricing/) · [Fly Managed Postgres](https://fly.io/docs/mpg/)
- [Render pricing](https://render.com/pricing) · [Render free tier docs](https://render.com/docs/free)
- [Railway pricing](https://railway.com/pricing) · [Railway pricing docs](https://docs.railway.com/pricing)
- [AWS Lightsail pricing](https://aws.amazon.com/lightsail/pricing/)
- [AWS Fargate pricing](https://aws.amazon.com/fargate/pricing/)
- [AWS Elastic Load Balancing pricing](https://aws.amazon.com/elasticloadbalancing/pricing/)
- [AWS RDS for PostgreSQL pricing](https://aws.amazon.com/rds/postgresql/pricing/)
- [Hetzner Cloud](https://www.hetzner.com/cloud/)
- [DigitalOcean Droplet pricing](https://www.digitalocean.com/pricing/droplets)
- [Neon pricing](https://neon.com/pricing)
- [Supabase pricing](https://supabase.com/pricing)
- [CockroachDB pricing](https://www.cockroachlabs.com/pricing/)
- [PlanetScale pricing](https://planetscale.com/pricing)
- [Google Cloud SQL pricing](https://cloud.google.com/sql/pricing)
- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Vercel pricing](https://vercel.com/pricing)
- [Netlify pricing](https://www.netlify.com/pricing/)
- AWS Free Tier general terms — verify current status directly at [aws.amazon.com/free](https://aws.amazon.com/free/) since 12-month eligibility depends on account age
