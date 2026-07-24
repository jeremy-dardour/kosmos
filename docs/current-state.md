# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-07-24_

## Phase

**Building.** First build slice (#17 — entities + migration) is in PR #28, but
review fix-up is still in progress. 9 issues remaining after #17 merges.

## Done

- Domain model defined and agreed — entities, statuses, and rules in
  [CONTEXT.md](../CONTEXT.md); full behavioral spec with rationale in the
  [V1 Product PRD](./specs/v1-product/PRD.md).
- UI direction chosen: the two-panel "Pipeline Stack" wireframe
  ([docs/prototype/timeline/](./prototype/timeline/), turn 3 / option 3a).
- Specified the Workstream **pipeline state machine** end-to-end
  ([ADR 0005](./adr/0005-workstream-pipeline-state-machine.md)).
- Entity/schema design written
  ([entity-schema-design.md](./entity-schema-design.md)).
- Auth approach resolved: GIS + `.env` allow-list, consent screen "In
  production" with non-sensitive scopes.
  ([docs/specs/auth/PRD.md](./specs/auth/PRD.md)).
- API contract resolved: unified `advance` endpoint, one overview aggregate
  read, flat CRUD, derived state server-side.
  ([docs/specs/api-contract/PRD.md](./specs/api-contract/PRD.md)).
- Hosting & deployment resolved: Cloud Run + Neon, single deployable, ~$0/mo.
- Overview UI build slices defined: 7 ordered increments.
- State machine implementation decisions resolved: unified `advance` API,
  private methods on `WorkstreamService`, explicit transactions for advance +
  reorder only, pure utility functions for derived state.
  (see [V1 Tech Design § State machine](./specs/v1-tech-design.md)).
- **V1 Technical Design** written — links all decisions.
  ([docs/specs/v1-tech-design.md](./specs/v1-tech-design.md)).
- **10 GitHub issues created** (end-to-end build slices):
  [#17](https://github.com/jeremy-dardour/wedding-planner/issues/17)–[#26](https://github.com/jeremy-dardour/wedding-planner/issues/26).
- **Wayfinder map complete** — all 9 tickets resolved.
- **#17 — Entities + initial migration** — 7 entities defined and PR #28 open,
  but review found entity decorator, e2e, schema-integrity, and API contract
  follow-up work before merge
  ([session 11](./sessions/session-11-2026-07-23-entities-migration.md),
  [session 12](./sessions/session-12-2026-07-23-pr-28-review-fix-wip.md)).
- Path-scoped `.claude/rules/` added for API, web, and entity files; ported
  to sibling template repo. Entity standards extracted to
  [ENTITIES_STANDARDS.md](../apps/api/ENTITIES_STANDARDS.md), type errors
  fixed, `updatedAt` onUpdate added, composite FKs removed (service-layer
  guards instead, [ADR 0006](./adr/0006-same-parent-integrity-in-service-layer.md)).
  Parallel workspace ports fixed and documented. Dead template items files
  removed. All lint/type/test checks pass
  ([session 13](./sessions/session-13-2026-07-24-rules-entities-ports.md)).

## Open questions

- `deferMode: 'deferred'` on `@Unique` constraints (Step, ChecklistItem) does
  not produce `DEFERRABLE INITIALLY DEFERRED` in MikroORM's generated SQL.
  Service layer will need to handle constraint ordering for bulk reorder.

## Next steps

Finish PR #28 review fix-up before starting #18:

- Entity definitions are type-clean, lint-clean, documented.
- Migration verified against `schema:update --dump` — matches exactly.
- Regenerate migration (fresh, post-composite-FK removal) if needed.
- PR #28 ready for final review pass.
