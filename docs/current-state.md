# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. History lives in
[docs/sessions/](./sessions/); one line per merged PR below, details in the
linked docs.

_Last updated: 2026-08-05 (session 42 addendum)_

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
  [tech design](./specs/multi-tenancy/tech-design.md) — T-1 (#53) and T-2
  (#54) shipped; T-3/T-4 (#55/#56) built on `feat/multi-tenancy-t3-t4`
  ([plan](./specs/multi-tenancy/t3-t4-implementation-plan.md)), in review as [PR #64](https://github.com/jeremy-dardour/kosmos/pull/64)

## Phase

**V1 is feature-complete and deployed** — Cloud Run + Neon shipped via PR #58,
[#26](https://github.com/jeremy-dardour/kosmos/issues/26) closed.
Current feature: multi-tenancy (T-1 and T-2 merged; T-3 + T-4 implemented on
one branch, in review). Deployment hardening shipped in PR #60; the Kosmos
rename including the external cutover is complete.

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
- PR #62 — Kosmos rename: product identity, positioning, template cleanup,
  reviewed twice ([PRD](./specs/kosmos-rename/PRD.md) +
  [implementation plan](./specs/kosmos-rename/implementation-plan.md)), incl.
  `deployment/provision.sh` and the allow-list moved to Secret Manager
- PR #61 — multi-tenancy T-2: membership enforcement on every route,
  member-only users directory, tenancy sweep + coverage meta-test

## In flight

- **[PR #64](https://github.com/jeremy-dardour/kosmos/pull/64)** (`feat/multi-tenancy-t3-t4`) — T-3 (#55) + T-4 (#56) implemented per the
  [review-amended plan](./specs/multi-tenancy/t3-t4-implementation-plan.md):
  members endpoints + dialog (pending invites, leave, caps), transfer
  ownership, soft delete/restore with settings danger zone and a Deleted
  list section. Locked governance transactions (`lockVisibleProject`),
  three-actor tenancy sweep with `deletedOwnerStatus` axis, decisions D6–D8
  recorded. Per-ticket review batteries run and actioned. Jeremy's PR review
  comments actioned (session 42 addendum): overview `users` is now the
  assignment directory (referenced owners, member or not; ex-members render
  greyed), membership is the members endpoint's fact alone, and pickers
  offer joined members only. Awaiting merge.

The Kosmos rename **including the external cutover is complete**: repository
`jeremy-dardour/kosmos`, Cloud Run service `kosmos` (512Mi, serving),
`kosmos-runtime` SA, WIF on the new slug, OAuth rebranded, CD + nightly backup
verified, old-name resources deleted. The GCP project keeps its immutable ID
(see [provisioning](./provisioning.md)).

## Open questions

- Should the brand mark adapt to light/dark theme? (tracked in the
  [rename PRD](./specs/kosmos-rename/PRD.md#open-questions); decide during a
  visual pass)

## Next steps

1. Review and merge the **T-3 + T-4 PR ([#64](https://github.com/jeremy-dardour/kosmos/pull/64))**,
   closing #55 and #56 — completing the multi-tenancy feature.
2. Delete `docs/specs/multi-tenancy/t3-t4-implementation-plan.md` once
   merged (point-in-time record; durable decisions live in the tech design).
