# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for domain decisions and rationale, see
[docs/domain-decisions.md](./domain-decisions.md).

_Last updated: 2026-07-20_

## Phase

**Pre-implementation — schema designed, research done, ready for API contract.**
The domain model is fully settled. Ticket 01 (data-model & schema) is complete —
all 16 design questions resolved, entity/schema design document written
([entity-schema-design.md](./entity-schema-design.md),
[session 06](./sessions/session-06-2026-07-19-schema-grilling.md)). Research for
Tickets 02 and 03 (auth internals, hosting/deploy) is complete and awaiting
review. No domain code written yet (still the monorepo template).

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
  decisions resolved; full list in
  [session 06](./sessions/session-06-2026-07-19-schema-grilling.md#decisions).
- **Ticket 02 — auth research complete:**
  [docs/research/auth-internals.md](./research/auth-internals.md). Key finding:
  Google Groups not viable on consumer Gmail; GIS + static/DB allow-list is the
  front-runner.
- **Ticket 03 — hosting research complete:**
  [docs/research/hosting-deploy.md](./research/hosting-deploy.md). Key finding:
  Cloud Run + Neon + single deployable recommended.

## Open questions

_None at the domain or schema level._

## Next steps

1. **Review research docs** — read `auth-internals.md` and `hosting-deploy.md` in
   detail; feed into Tickets 05 (auth approach) and 06 (deployment approach).
2. Continue the [V1-build wayfinder map](./wayfinder/v1-build/map.md): API
   contract (04) → auth/deploy decisions (05/06) → UI slices (07) → sequence
   increments (08).
