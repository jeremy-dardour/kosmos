# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for domain decisions and rationale, see
[docs/domain-decisions.md](./domain-decisions.md).

_Last updated: 2026-07-21_

## Phase

**Pre-implementation — auth, API contract, and schema designed; deploy and state
machine implementation still to decide.** The domain model is fully settled.
Auth approach decided (GIS + `.env` allow-list). API contract designed (endpoints,
DTOs, overview read model). No domain code written yet (still the monorepo
template).

## Done

- Domain model defined and agreed — entities, statuses, and rules in
  [CONTEXT.md](../CONTEXT.md); the decisions behind them in
  [docs/domain-decisions.md](./domain-decisions.md).
- UI direction chosen: the two-panel "Pipeline Stack" wireframe
  ([docs/prototype/timeline/](./prototype/timeline/), turn 3 / option 3a).
- Documentation restructured and CONTEXT.md reconciled with the chosen prototype.
- Closed the last three open product questions (Decisions 26–28): access gated
  outside the app (no in-app whitelist), notifications pull-only, and a generic
  Project container so "wedding" isn't hardcoded.
- Specified the Workstream **pipeline state machine** end-to-end
  ([ADR 0005](./adr/0005-workstream-pipeline-state-machine.md); Decisions 29–33)
  and modelled the `User` and `Group` entities (Decisions 34–35).
- Closed the remaining entity questions (Decisions 36–40): no Dependency entity,
  Project holds an optional event date, "last-step deadline" is a soft nudge,
  notes are author-editable, and Link is folded into notes (clickable URLs).
- Set up the agent tooling (`docs/agents/`, `CLAUDE.md` § Agent skills) and
  charted the **V1-build wayfinder map** (8 tickets; frontier: schema, auth
  research, hosting research).
- **Ticket 01 complete — entity/schema design written**
  ([entity-schema-design.md](./entity-schema-design.md)). All 16 schema
  decisions resolved in
  [session 06](./sessions/session-06-2026-07-19-schema-grilling.md#decisions).
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

## Open questions

_None at the domain or schema level._

- **State machine implementation** (ticket 09): how `start`/`advance` work
  transactionally with MikroORM — flush ordering, pointer update, position
  lookup, validation placement.

## Next steps

1. **Review hosting research** — read `hosting-deploy.md`; feed into a deploy
   PRD when ready.
2. **Grill state machine implementation** (ticket 09) — transactional logic for
   `start`/`advance` with MikroORM.
3. Sequence the build increments (walking-skeleton-first) and write per-increment
   PRDs.
