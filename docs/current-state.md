# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-07-28 (session 24)_

## Phase

**Building.** Slices 1 and 2 are open as PRs #31 and #36; six
build-slice/deployment issues remain (#20–#24, #26).

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
- **Web auth composed as `AuthSystem`** (#33) — a four-member `AuthSession` plus
  the provider-specific sign-in affordance. Google uses only the official GIS
  rendered button; One Tap and its prompt state machine are removed. Stale
  credential validation cannot undo logout or overwrite a newer session.
  `AuthProviderBoundary` and both rerender hacks remain deleted
  ([sessions 15–21](./sessions/session-15-20-2026-07-24-auth-v1-1.md)).
- **#18 — Slice 1: layout shell + overview data + card list** — complete on
  `feat/slice-1-overview`. A single `project` module owns the aggregate
  ([module layout](../apps/api/module-layout.md)); the overview aggregate read derives
  lifecycle, step status, owner inheritance and nearest-deadline selection
  server-side from one repeatable-read snapshot. User display data is normalized
  into one summary directory; owner and deadline relationships use IDs. A
  follow-up contract alignment for #19 will replace the near-duplicate overview
  Workstream and Step DTOs with the canonical entity response shapes. The web
  derives relative countdowns from stable dates and refreshes them at local
  midnight. It renders grouped cards with pipeline dots in light and dark themes.
  The API now isolates MikroORM behind entity-only repositories; services own
  DTO-to-entity orchestration, while the overview uses a query-focused
  repository for its consistent entity graph. Dev seeder covers every
  lifecycle/status/urgency combination
  ([session 15](./sessions/session-15-2026-07-25-slice-1-overview.md)).
- **PR #31 reviewed and fixed.** Blocking: `@IsOptionalNotNull()` stops an
  explicit `null` reaching a non-nullable column (422, not 500);
  `WorkstreamService.remove` is one transaction. Cleanups: `StepContext`
  removed, calendar-day helpers consolidated, the whole project module on one
  data-access idiom, `isBlockedNow()` shared on the web, `sr-only` status on
  pipeline dots, `eventYesterday`
  ([session 15](./sessions/session-15-2026-07-25-slice-1-overview.md)).

- **#19 — Slice 2: detail slide-over (read-only)** — complete on
  `feat/slice-2` (PR #36). `OverviewStepDto` replaced with canonical `StepDto`;
  `noteCount` dropped. New `GET /workstreams/:workstreamId/notes` endpoint with
  DB-level ordering. Detail panel shows vertical pipeline, inline checklist,
  on-demand notes with URL linkification. Selection state derives from overview
  query data. Mobile detail panel deferred to #35
  ([sessions 23–24](./sessions/session-23-24-2026-07-27-slice-2-detail-panel-integration.md)).
- **DTO type decoupling + integration tests + MSW** — API hooks re-export
  named type aliases; feature code never imports `@/types/openapi` directly.
  11 integration tests cover the overview + detail panel. Hand-rolled fetch
  mock replaced with MSW. The test harness composes the real required providers
  ([sessions 23–24](./sessions/session-23-24-2026-07-27-slice-2-detail-panel-integration.md)).

## In flight

- **PR #31 (`feat/slice-1-overview`)** — Slice 1: overview aggregate read +
  Pipeline Stack UI (#18).
- **PR #36 (`feat/slice-2`)** — Slice 2: detail slide-over (read-only) (#19).

## Open questions

- Overview ordering is alphabetical (groups and workstreams by name) — nothing
  in the specs states an order. Revisit if manual ordering is wanted.

## Next steps

1. Land PRs #31 and #36.
2. Build slices #20–#24, then deployment (#26). Reorder repositories use
   two-phase temporary positions because the generated constraints are not
   deferrable.
3. Mobile responsiveness deferred to #35.
