# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-07-26_

## Phase

**Building.** Foundations are merged (entities + migration, Google auth wiring).
Two PRs open in parallel: auth refinement (#32) and the first overview slice
(#31). 8 build-slice issues remain after those land.

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
  production" with non-sensitive scopes
  ([docs/specs/auth/PRD.md](./specs/auth/PRD.md)).
- API contract resolved: unified `advance` endpoint, one overview aggregate
  read, flat CRUD, derived state server-side
  ([docs/specs/api-contract/PRD.md](./specs/api-contract/PRD.md)).
- Hosting & deployment resolved: Cloud Run + Neon, single deployable, ~$0/mo.
- **V1 Technical Design** written — links all decisions
  ([docs/specs/v1-tech-design.md](./specs/v1-tech-design.md)).
- **10 GitHub issues created** (end-to-end build slices):
  [#17](https://github.com/jeremy-dardour/wedding-planner/issues/17)–[#26](https://github.com/jeremy-dardour/wedding-planner/issues/26).
- **Wayfinder map complete** — all 9 tickets resolved.
- **#17 — Entities + initial migration** merged (PR #28). 7 entities, composite
  FKs replaced by service-layer guards
  ([ADR 0006](./adr/0006-same-parent-integrity-in-service-layer.md)); entity
  standards extracted to
  [ENTITIES_STANDARDS.md](../apps/api/ENTITIES_STANDARDS.md).
- **Google authentication wired** end-to-end and merged (PR #29).
- Path-scoped `.claude/rules/` added for API, web, and entity files; parallel
  workspace ports fixed and documented in `CLAUDE.md § Ports`.
- **Web auth module boundaries settled**
  ([ADR 0007](./adr/0007-web-auth-module-boundaries.md)): `/users/me` extracted
  out of `GoogleAuthProvider`, only `401` invalidates a session, fake auth stays
  offline for e2e.
- **`AuthProvider` collapsed to 5 members** (#33) — `getState()` + `subscribe()`
  read via `useSyncExternalStore`, sign-in widget moved out of the interface;
  `AuthProviderBoundary` and both rerender hacks deleted
  ([sessions 15–20](./sessions/session-15-20-2026-07-24-auth-v1-1.md)).

## In flight

- **PR #32 (`auth-v1.1`)** — session restore (#30), the sign-in button fix,
  `/users/me` extraction, landing-page cleanup, and the `AuthProvider` collapse
  (#33). All checks green; needs a final review pass, then merge.
- **PR #31 (`feat/slice-1-overview`)** — Slice 1: overview aggregate read +
  Pipeline Stack UI (#18).

## Open questions

- `deferMode: 'deferred'` on `@Unique` constraints (Step, ChecklistItem) does
  not produce `DEFERRABLE INITIALLY DEFERRED` in MikroORM's generated SQL.
  Service layer will need to handle constraint ordering for bulk reorder.

## Next steps

1. Land PR #32 (and close
   [#33](https://github.com/jeremy-dardour/wedding-planner/issues/33) with it),
   then PR #31.
2. Build slices #19–#24, then deployment (#26).
3. Web e2e coverage is currently a single placeholder — real specs belong with
   the overview slices, and `ApiMock` still targets the deleted `/api/items`.
4. Open review comment: `current-user.ts` still uses a bare `fetch` rather than
   the shared client. Constrained by the client's 401 sign-out middleware.
