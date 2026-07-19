# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects *now*. For the history of how we got here, see
[docs/sessions/](./sessions/); for domain decisions and rationale, see
[docs/domain-decisions.md](./domain-decisions.md).

_Last updated: 2026-07-19_

## Phase

**Pre-implementation, domain model complete — now planning the V1 build.** The
full domain model is settled (Workstream state machine in
[ADR 0005](./adr/0005-workstream-pipeline-state-machine.md); all entities pinned,
Decisions 29–40) with no open domain questions. The V1 build is being planned via
the wayfinder map at [docs/wayfinder/v1-build/](./wayfinder/v1-build/map.md) —
decompose V1 into buildable increment-specs. No domain code written yet (still the
monorepo template).

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

## Open questions

_None — the V1 domain model is fully specified._

## Next steps

Work the [V1-build wayfinder map](./wayfinder/v1-build/map.md), one ticket per
session (frontier first):

1. **Ticket 01 — data-model & schema** (grilling): translate CONTEXT.md + ADR 0005
   into the MikroORM schema + API shape.
2. **Tickets 02 / 03 — auth & hosting research** (AFK, Sonnet 5): can run in
   parallel; unblock the auth and deployment decisions.
3. Downstream: API contract → UI slices → sequence V1 into increment-specs.
