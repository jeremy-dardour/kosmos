# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. History lives in
[docs/sessions/](./sessions/); one line per merged PR below, details in the
linked docs.

_Last updated: 2026-08-04 (session 37)_

## What this is

A visual pipeline tracker for wedding preparation — 20–50 workstreams, each
an ordered step pipeline with one overview screen where everything is edited
inline. The specs are the source of truth:

- [V1 Product PRD](./specs/v1-product/PRD.md) — behavior + rationale;
  glossary in [CONTEXT.md](../CONTEXT.md)
- [V1 tech design](./specs/v1-tech-design.md) — schema, state machine, API
  ([api-contract.md](./specs/v1-product/api-contract.md)), auth, deploy;
  decisions in [docs/adr/](./adr/)
- [Auth PRD](./specs/auth/PRD.md) — Google GIS + `.env` allow-list
- [Multi-tenancy PRD](./specs/multi-tenancy/PRD.md) +
  [tech design](./specs/multi-tenancy/tech-design.md) — next feature, specced
  and ticketed (#53→#56), not started

## Phase

**V1 is feature-complete on main** — all build slices, the inline overview
rework, and the widget panel are merged. Remaining before "done":
**deployment ([#26](https://github.com/jeremy-dardour/wedding-planner/issues/26))**.
Next feature: multi-tenancy.

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

## In flight

- **PR #57 (`docs/multi-tenancy-specs`)** — this docs PR (multi-tenancy
  specs and session 37 log), open.

## Open questions

- None.

## Next steps

1. **Deployment (#26)** — the last V1 milestone. Include the noted
   `NULLS NOT DISTINCT` migration for the ungrouped workstream position
   scope while a migration PR is open anyway.
2. **Multi-tenancy T-1 ([#53](https://github.com/jeremy-dardour/wedding-planner/issues/53))**
   — unblocked now that PR #52 is merged; then #54 → #55 → #56.
