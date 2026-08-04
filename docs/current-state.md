# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. History lives in
[docs/sessions/](./sessions/); one line per merged PR below, details in the
linked docs.

_Last updated: 2026-08-04 (session 40)_

## What this is

Kosmos is a visual project-management pipeline tracker for projects with many
parallel workstreams. Each workstream is an ordered step pipeline, shown in one
overview where everything is edited inline. The specs are the source of truth:

- [V1 Product PRD](./specs/v1-product/PRD.md) — behavior + rationale;
  glossary in [CONTEXT.md](../CONTEXT.md)
- [V1 tech design](./specs/v1-tech-design.md) — schema, state machine, API
  ([api-contract.md](./specs/v1-product/api-contract.md)), auth, deploy;
  decisions in [docs/adr/](./adr/)
- [Auth PRD](./specs/auth/PRD.md) — Google GIS + `.env` allow-list
- [Multi-tenancy PRD](./specs/multi-tenancy/PRD.md) +
  [tech design](./specs/multi-tenancy/tech-design.md) — in progress: T-1
  (#53) shipped, T-2→T-4 (#54→#56) remaining

## Phase

**V1 is feature-complete and deployed** — Cloud Run + Neon shipped via PR #58,
[#26](https://github.com/jeremy-dardour/wedding-planner/issues/26) closed.
Current feature: multi-tenancy (T-1 shipped, then #54 → #56). Deployment
hardening shipped in PR #60; the Kosmos product and infrastructure rename is in
progress.

## Shipped (one line per PR)

- PR #28 — entities + initial migration (#17); ADR 0006
- PR #29 — Google auth end-to-end (#25); web auth boundaries: ADR 0007
- PR #31 — slice 1: layout shell + overview aggregate + card list (#18)
- PR #36 — slice 2: read-only detail panel + notes read (#19)
- PR #37 — slice 3: advance/start actions (#20); ADR 0005
- PR #38 — slice 6: pipeline + checklist editing (#23); ADR 0009
- PR #42 — slice 4: deadline badges + owner/group filters (#21)
- PR #45 — slice 5: note add/edit/delete, author-guarded (#22)
- PR #44 — slice 7: workstream + group management dialogs (#24)
- PR #48 — inline overview rework, no detail panel (#40);
  [overview-rework-plan](./specs/v1-product/overview-rework-plan.md)
- PR #52 — widget panel: rail, Project pulse, calendar + agenda (#49, #50);
  ADR 0010
- PR #57 — multi-tenancy specs (PRD + tech design, tickets #53→#56) +
  session 37 log
- PR #58 — Cloud Run + Neon deployment (#26), incl. the ungrouped-position
  `NULLS NOT DISTINCT` migration
- PR #59 — multi-tenancy T-1: per-user project list + owned project creation
- PR #60 — production API docs disabled and nightly backup workflow hardened

## In flight

- **Draft PR #62 (`chore/kosmos-rename`)** — product identity,
  project-management positioning, and template cleanup; tracked in the
  [implementation plan](./specs/kosmos-rename/implementation-plan.md). The
  GitHub/GCP/OAuth cutover follows after merge.

## Open questions

- None.

## Next steps

1. Complete the [Kosmos rename](./specs/kosmos-rename/implementation-plan.md),
   including repository and production infrastructure cutover.
2. **T-2
   ([#54](https://github.com/jeremy-dardour/wedding-planner/issues/54))** — the
   security boundary: enforcement on flat routes, project get/patch and
   overview, honoring the constraints recorded in the
   [tech design's Attach-on-login section](./specs/multi-tenancy/tech-design.md#attach-on-login);
   then #55 → #56.
