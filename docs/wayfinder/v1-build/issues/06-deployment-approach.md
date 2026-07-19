<!-- wayfinder:grilling -->

# Deployment & hosting approach

Type: grilling
Status: open
Blocked by: 03

## Question

Given the options from ticket 03, decide how V1 is stood up and shipped.

Decide:

- **App host** and **managed Postgres** provider.
- **CD pipeline** — how a merge reaches production (build image → run migrations
  at container start → deploy), building on whatever CI already exists.
- **Secrets/env management** — including the `.env` email allowlist and Google
  OAuth prod credentials.
- **Custom domain + TLS**.
- **Prod Google OAuth app setup** — the console-side setup that gates access
  (Decision 26); coordinate with _Auth approach_ (ticket 05).
- **Cost** — confirm the monthly figure fits a personal budget.

Weight simplicity + cost for a solo dev. Output: the deployment decision
(candidate ADR) + the shape of the deploy/infra increment. Input to _Sequence V1_.
