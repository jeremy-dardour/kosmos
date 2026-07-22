# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-07-22_

## Phase

**Pre-implementation — V1 fully specified; state machine implementation still
to decide.** The domain model is settled. Auth, API contract, UI build slices,
and deployment approach all decided. V1 Product PRD written (the single
behavioral spec with inlined rationale). No domain code written yet (still the
monorepo template).

## Done

- Domain model defined and agreed — entities, statuses, and rules in
  [CONTEXT.md](../CONTEXT.md); full behavioral spec with rationale in the
  [V1 Product PRD](./specs/v1-product/PRD.md).
- UI direction chosen: the two-panel "Pipeline Stack" wireframe
  ([docs/prototype/timeline/](./prototype/timeline/), turn 3 / option 3a).
- Specified the Workstream **pipeline state machine** end-to-end
  ([ADR 0005](./adr/0005-workstream-pipeline-state-machine.md)).
- Set up the agent tooling (`docs/agents/`, `CLAUDE.md` § Agent skills) and
  charted the **V1-build wayfinder map** (9 tickets).
- **Ticket 01 — entity/schema design written**
  ([entity-schema-design.md](./entity-schema-design.md)).
- **Ticket 02 — auth research resolved:**
  [docs/research/auth-internals.md](./research/auth-internals.md).
- **Ticket 03 — hosting research resolved:**
  [docs/research/hosting-deploy.md](./research/hosting-deploy.md).
- **Ticket 05 — auth approach resolved:** GIS + `.env` allow-list, consent
  screen "In production" with non-sensitive scopes. PRD at
  [docs/specs/auth/PRD.md](./specs/auth/PRD.md).
- **Ticket 04 — API contract resolved:** one overview aggregate read, named
  RPCs for start/advance, flat CRUD, derived state server-side. PRD at
  [docs/specs/api-contract/PRD.md](./specs/api-contract/PRD.md).
- **V1 Product PRD written** — consolidates all 40 domain decisions with
  rationale; `domain-decisions.md` retired.
- **Ticket 07 — Overview UI build slices:** resolved. 7 ordered increments
  from layout shell through write actions. English-first i18n, same
  `openapi-react-query` data-fetching pattern. →
  [issue 07](../docs/wayfinder/v1-build/issues/07-ui-build-slices.md)
- **Tickets 03 + 06 — Hosting & deployment:** resolved. Cloud Run + Neon +
  single deployable. ~$0/mo steady state, indefinite free tiers. →
  [issue 06](../docs/wayfinder/v1-build/issues/06-deployment-approach.md)

## Open questions

_None at the domain or schema level._

- **State machine implementation** (ticket 09): how `start`/`advance` work
  transactionally with MikroORM — flush ordering, pointer update, position
  lookup, validation placement.

## Next steps

1. **Ticket 09 — State machine implementation** — unblocked (04 resolved).
2. **Ticket 08 — Sequence V1 into ordered increment-specs** — unblocked
   (06 + 07 both resolved). This is the last planning ticket before building.
