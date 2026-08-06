# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. History lives in
[docs/sessions/](./sessions/); one line per merged PR below, details in the
linked docs.

_Last updated: 2026-08-06 (session 44)_

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
  [tech design](./specs/multi-tenancy/tech-design.md) — T-1 (#53), T-2 (#54)
  and T-3/T-4 (#55/#56) all shipped; the feature is complete

## Phase

**V1 is feature-complete and deployed** — Cloud Run + Neon shipped via PR #58,
[#26](https://github.com/jeremy-dardour/kosmos/issues/26) closed.
**Multi-tenancy is complete** (T-1 → T-4 all merged). Deployment hardening
shipped in PR #60; the Kosmos rename including the external cutover is
complete. Current work: trialling the AGO assistant SDK in the web app.

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
- PR #64 — multi-tenancy T-3 + T-4: members endpoints + dialog, transfer
  ownership, soft delete/restore with the settings danger zone and a Deleted
  list section; three-actor tenancy sweep, decisions D6–D8

## In flight

- **`feat/ago-sdk`** — trialling the [AGO](https://useago.com) assistant SDK
  in the web app. Shipped so far: the shared web provider stack folded into one
  `AppProvider`; the assistant itself — provider + `ChatWidget` in a togglable
  right-hand panel in `AppLayout` (signed-in only, gated on `VITE_AGO_BASE_URL`);
  then the agency layer — router navigation (`useAgoNavigation` + auto-continue,
  off a pure-data `nav-routes` manifest) and callable client functions
  (`listProjects` app-wide, `listMembers` on the overview) built as render-free
  factories bound in lifecycle-scoped components, handlers fetching cache-first
  at invocation. Whole subsystem now lives under `src/assistant/`. Not yet
  viewed in a browser. See
  [session 43](./sessions/session-43-2026-08-05-ago-assistant.md),
  [session 44](./sessions/session-44-2026-08-06-ago-navigation-functions.md).

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

1. Look at the assistant in a browser: panel width against the overview's
   widget rail, and exercise navigation + `listProjects`/`listMembers`
   end-to-end. Decide whether `pageContext="auto"` (sends URL + tab title to
   the AGO backend) is wanted, and whether the split gating (shell inline
   `isAvailable` vs feature `AssistantScope`) is unified.
2. Delete `docs/specs/multi-tenancy/t3-t4-implementation-plan.md` — PR #64 is
   merged, so the plan is a spent point-in-time record (durable decisions live
   in the tech design).
