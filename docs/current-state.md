# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects *now*. For the history of how we got here, see
[docs/sessions/](./sessions/); for domain decisions and rationale, see
[docs/domain-decisions.md](./domain-decisions.md).

_Last updated: 2026-07-18_

## Phase

**Pre-implementation, domain model complete.** UI direction and the full domain
model are settled — the Workstream state machine is specified in
[ADR 0005](./adr/0005-workstream-pipeline-state-machine.md) and all entities are
pinned down (Decisions 29–40). No open questions. No domain code written yet
(still the monorepo template); next is data-model / schema design.

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

## Open questions

_None — the V1 domain model is fully specified._

## Next steps

1. Data-model design — translate CONTEXT.md + ADR 0005 into DB schema + API shape.
2. Break implementation into buildable increments.
