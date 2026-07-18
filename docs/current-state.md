# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects *now*. For the history of how we got here, see
[docs/sessions/](./sessions/); for domain decisions and rationale, see
[docs/domain-decisions.md](./domain-decisions.md).

_Last updated: 2026-07-18_

## Phase

**Pre-implementation.** Domain model and UI direction are settled; no domain
code written yet (the repo is still the monorepo template).

## Done

- Domain model defined and agreed — entities, statuses, and rules in
  [CONTEXT.md](../CONTEXT.md); the decisions behind them in
  [docs/domain-decisions.md](./domain-decisions.md).
- UI direction chosen: the two-panel "Pipeline Stack" wireframe
  ([docs/prototype/timeline/](./prototype/timeline/), turn 3 / option 3a).
- Documentation restructured and CONTEXT.md reconciled with the chosen prototype.

## Open questions

1. **Whitelist management** — who can add/remove emails from the allow-list? Any
   user, or only the workspace creator?
2. **Notifications** — any push/email when deadlines approach or steps advance,
   or purely pull-based? (Currently assumed pull-only.)
3. **Multi-project scope** — forever single-wedding, or a generic "workspace"
   that could be reused? Decides whether "wedding" is hardcoded.

## Next steps

1. Close the three open questions above.
2. Data-model design — translate CONTEXT.md into DB schema + API shape.
3. Break implementation into buildable increments.
