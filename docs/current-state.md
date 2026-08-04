# Current State

The single live snapshot of where the project is. Overwrite this as things
change — it always reflects _now_. For the history of how we got here, see
[docs/sessions/](./sessions/); for the full behavioral spec and rationale, see
the [V1 Product PRD](./specs/v1-product/PRD.md).

_Last updated: 2026-08-03 (session 35)_

## Phase

**#49 (widget rail + panel shell + Project pulse) implemented — PR #52 open
for review.** All twelve plan commits (C1–C12) landed green on
`feat/49-widget-panel` via orchestrated implementer agents, each diff
reviewed and gated (`check-types`/`lint`/full web suite) before committing.
Two independent review batches came back with three Low findings, all
actioned in-branch; the five inline PR questions are answered on PR #52.
Visual verification passed in light and dark (panel toggle + persistence,
stats vs seed, filter mirroring, cross-links, C11 button restyle).
Placeholder PR #51 is closed; `temp-from-proto-2` stays as prototype
reference until #50. Next: user review of PR #52, then **deployment
([#26](https://github.com/jeremy-dardour/wedding-planner/issues/26))** —
which should also pick up the noted `NULLS NOT DISTINCT` migration for the
ungrouped position scope. Session log:
[session 35](./sessions/session-35-2026-08-03-49-widget-panel-implementation.md).

## Done

- Domain model defined and agreed — entities, statuses, and rules in
  [CONTEXT.md](../CONTEXT.md); full behavioral spec with rationale in the
  [V1 Product PRD](./specs/v1-product/PRD.md).
- UI direction chosen: **inline overview editing** — one column, no detail
  panel, every edit in the card
  ([docs/prototype/overview-editing/](./prototype/overview-editing/)). This
  replaced the original two-panel "Pipeline Stack" wireframe, whose files were
  deleted once the specs were updated.
- Specified the Workstream **pipeline state machine** end-to-end
  ([ADR 0005](./adr/0005-workstream-pipeline-state-machine.md)).
- Entity/schema design written
  ([entity-schema-design.md](./entity-schema-design.md)).
- Auth approach resolved: GIS + `.env` allow-list, consent screen "In
  production" with non-sensitive scopes
  ([docs/specs/auth/PRD.md](./specs/auth/PRD.md)).
- API contract resolved: unified `advance` endpoint, one overview aggregate
  read, flat CRUD, derived state server-side
  ([docs/specs/v1-product/api-contract.md](./specs/v1-product/api-contract.md)).
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
- **#20 — Slice 3: advance + start pipeline actions** — complete on
  `feat/slice-3` (draft PR #37). One locked application command dispatches to
  distinct start and advance domain transitions. Overview cards expose Start,
  one-click Advance, Skip, and blocked-step Resolve actions with row-local
  pending state and descriptive Problem Details errors. A stateful MSW adapter
  supports all seven component-integration scenarios; new Playwright coverage
  is deferred by the web testing standard. A CI follow-up made the global auth
  guard read-only and moved concurrency-safe provisioning to `/users/me`
  ([session 25](./sessions/session-25-2026-07-28-slice-3-advance-actions.md)).
- **#23 — Slice 6: pipeline and checklist editing** — complete on
  `feat/slice-6` (draft PR #38). The canonical Workstream/Step DTO migration is
  finished. A locked, atomic Workstream-level command replaces the editable
  pipeline tail with optimistic concurrency, while checklist completion uses
  an immediate item-level mutation. Past Steps stay frozen; current-Step
  structure is guarded; explicit Step owners override inherited Workstream
  owners. The editor supports Step details and full Step/checklist
  add/remove/reorder flows. Stale drafts are discarded and refreshed. Current
  checklists default expanded; past/future checklists are compact and past
  controls remain disabled. Frontend coverage is Testing Library/MSW
  integration only; no Playwright E2E was added. Standards and spec re-reviews
  are clear
  ([session 26](./sessions/session-26-2026-07-28-slice-6-pipeline-editing.md)).
- **Step-editing UI/design review** was tracked in
  [#39](https://github.com/jeremy-dardour/wedding-planner/issues/39); answered
  by the inline-editing design below and closed into #40.
- **PR #38 review follow-up** — addressed all 13 review comments. Migrated four
  repositories to extend `EntityRepository<T>`, extracted `validatePipelineEdit`
  from `replacePipeline`, added 14 service unit tests and 13 component tests,
  simplified `mock-api.ts`, documented the repository extension pattern in API
  standards
  ([session 27](./sessions/session-27-2026-07-30-pr38-review-followup.md)).
- **#21 — Slice 4: deadline badges + filters** — complete on
  `feat/next-feature`. Deadline countdown badges on overview cards with three
  urgency bands, date ticks under pipeline dots, overdue card treatment
  (matches blocked border), owner filter (single-select by current-step
  effective owner, excludes NotStarted/Complete), and group filter
  (multi-select show/hide). Shared `urgency.ts` module and `FilterTrigger`
  component extracted (no `useCurrentDate` hook exists — the overview reads
  one clock at render; stale urgency on a long-lived tab is an accepted V1
  limitation). 7 integration tests added. No API changes
  ([session 28](./sessions/session-28-2026-07-30-slice-4-deadline-badges-filters.md)).
- **#22 — Slice 5: notes actions** — complete on `feat/slice-5`. Notes are
  independently collapsible per persisted Step in normal and pipeline-editing
  views. Authors can add, edit, and delete their own notes; both the frontend
  and API reject mutations by other users. Unsaved Steps cannot accept notes,
  and note mutations preserve pipeline drafts. The OpenAPI contract, stateful
  MSW adapter, integration coverage, and API E2E coverage are updated
  ([session 29](./sessions/session-29-2026-07-30-slice-5-notes-actions.md)).
- **#24 — Slice 7: workstream + group management** — complete on `feat/slice-7`
  (6 unitary commits). Frontend-only (backend CRUD existed from Slice 1). Seven
  mutation hooks + a shared `useInvalidateOverview` seam; four dialogs
  (`WorkstreamFormDialog` create/edit, `GroupManagerDialog`,
  `ProjectSettingsDialog`, shared `ConfirmDialog`); header + detail-panel entry
  points. Group deletion relies on backend `SET NULL`. Fixed a real test-harness
  i18n bug (`escapeValue` divergence double-escaped `&` in interpolated names).
  `/code-review` run; one spec gap (event-date/countdown coverage) resolved.
  Two review rounds addressed on PR #44: renamed `useUpdatePipeline` →
  `useUpdateWorkstreamPipeline`, extracted a shared `FormDialog` (now in
  `components/ui/` with its own spec), un-nested the group delete confirm,
  removed redundant comments, and deleted the planning doc. Rebased on latest
  main (Slices 4/5 merged upstream). Deferred edit-UX polish tracked in #43
  ([session 30](./sessions/session-30-2026-07-30-slice-7-management.md)).

- **Inline overview editing settled** — prototype and specs on `prototype-2`.
  Every Workstream / Step / checklist / note edit happens inline in the overview
  list with **no detail panel**; the V1 PRD now specifies it and the superseded
  two-panel wireframe is deleted. Decisions, rejected ideas, backend
  requirements, a component map and a full behaviour spec are in
  [docs/prototype/overview-editing/HANDOFF.md](./prototype/overview-editing/HANDOFF.md)
  ([session 31](./sessions/session-31-2026-07-31-inline-overview-editing.md)).
  All UI rework tickets are consolidated into
  [#40](https://github.com/jeremy-dardour/wedding-planner/issues/40).

- **#40 fully unblocked** — a second prototyping pass on `prototype-2` added
  the collapsed Completed section, manual drag & drop ordering (dnd-kit), the
  advance control (B3: right of the status badges), 13px step titles,
  owner-override markers, light frames on complete cards and tooltips. B1/B2
  settled through a data-lifecycle grilling: `noteCount` on the aggregate;
  commit-on-blur with granular step/checklist endpoints replacing the
  whole-tail pipeline PUT; last-write-wins + per-op validation; mutation
  responses patched into the cached aggregate with a focus-deferred trailing
  invalidate; throttle raise. The api-contract spec moved to
  [docs/specs/v1-product/api-contract.md](./specs/v1-product/api-contract.md)
  and was rewritten; the phased build plan is
  [overview-rework-plan.md](./specs/v1-product/overview-rework-plan.md)
  ([session 32](./sessions/session-32-2026-07-31-prototype-2-and-b-decisions.md)).

- **#40 — inline overview rework** merged as PR #48 (squash commit `6bec1b3`
  on main).
- **#49 — widget rail, panel shell, Project pulse** — implemented on
  `feat/49-widget-panel` (PR #52). New `features/overview/widgets/`
  subsystem: pure derivations (`collectDeadlineEntries` — #50 lifts it
  wholesale — and `derivePulseStats`), presentational
  CollapsibleSection/DeadlineRow/StatsWidget/WidgetRail/WidgetSidebar
  (inert without injected callbacks), persisted open/collapsed state via a
  new generic `useLocalStorageState` behind a narrow shape guard, a new
  tooltip primitive over Base UI, the `--urgency-far` token completing the
  five-band set, a shared `deadlineCountdown` wording helper, selection
  state hoisted to `OverviewPage` (controlled list), localized filter
  mirroring with the repo's first CLDR plural keys, next-deadline
  cross-links (open step editor + scroll, hover highlight ring), and the
  C11 advance-button secondary restyle. Standards additions: `.types.ts`
  suffix for type-only modules; feature-hosted subsystem folders. Eight
  integration scenarios cover the panel end-to-end; test-env caveat: Node
  25 shadows jsdom `localStorage`, specs stub an in-memory Storage.

## In flight

- **PR #52 (`feat/49-widget-panel`)** — implementation complete, awaiting
  the user's review.

## Open questions

- None.

## Next steps

1. User review + squash-merge of PR #52.
2. **Deployment (#26)** — the last V1 milestone. Include the noted
   `NULLS NOT DISTINCT` migration for the ungrouped workstream position
   scope while a migration PR is open anyway.
3. **#50 — calendar + agenda widgets** (post-V1), building on the #49 shell;
   delete `docs/prototype/widget-panel/` and the `temp-from-proto-2` branch
   when it lands.
