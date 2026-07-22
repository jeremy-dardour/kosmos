# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-07-22_

## Phase

**Pre-implementation — V1 fully specified; deploy and state machine
implementation still to decide.** The domain model is settled. Auth approach
decided. API contract designed. V1 Product PRD written (the single behavioral
spec with inlined rationale). No domain code written yet (still the monorepo
template).

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
- **Ticket 02 — auth research complete:**
  [docs/research/auth-internals.md](./research/auth-internals.md).
- **Ticket 03 — hosting research complete:**
  [docs/research/hosting-deploy.md](./research/hosting-deploy.md).
- **Ticket 05 — auth approach resolved:** GIS + `.env` allow-list, consent
  screen "In production" with non-sensitive scopes. PRD at
  [docs/specs/auth/PRD.md](./specs/auth/PRD.md).
- **Ticket 04 — API contract resolved:** one overview aggregate read, named
  RPCs for start/advance, flat CRUD, derived state server-side. PRD at
  [docs/specs/api-contract/PRD.md](./specs/api-contract/PRD.md).
- **V1 Product PRD written** — consolidates all 40 domain decisions with
  rationale; `domain-decisions.md` retired.

## Open questions

_None at the domain or schema level._

- **State machine implementation** (ticket 09): how `start`/`advance` work
  transactionally with MikroORM — flush ordering, pointer update, position
  lookup, validation placement.

## Next steps

1. **Close tickets 02 and 03** — research is done but tickets need formal
   resolution in the tracker (which unblocks ticket 06).
2. **Ticket 06 — Deployment & hosting approach** — blocked by 03; unblocks once
   03 is closed.
3. **Ticket 07 — Overview UI build slices** — unblocked (04 resolved).
4. **Ticket 09 — State machine implementation** — unblocked (04 resolved).
5. Sequence the build increments (ticket 08, blocked by 06 + 07) and write
   per-increment PRDs.
