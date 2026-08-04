# Session 40 — Kosmos rename (2026-08-04)

## What was done

- Planned the rename from wedding-planner to Kosmos and recorded the staged
  implementation and external cutover in the
  [implementation plan](../specs/kosmos-rename/implementation-plan.md).
- Added the Kosmos orbit/constellation mark, favicon, product copy, API identity,
  and English/French/Spanish branding.
- Removed template placeholders from package, Docker, database, authentication,
  and mock Problem Details namespaces.
- Repositioned current product documentation around general project management
  while preserving wedding projects as valid examples and fixtures.
- Renamed, migrated, and seeded the local development and E2E databases.
- Opened draft [PR #62](https://github.com/jeremy-dardour/wedding-planner/pull/62)
  with two implementation commits.
- Ran the two-axis review battery (standards + spec, Opus sub-agents) and
  actioned the findings: restored the V1 PRD as a historical record, removed
  couple-specific wording from the multi-tenancy PRD, deleted the remaining
  item-template leftovers (orphaned API DTOs, commented-out Playwright spec,
  fixture, README section), fixed the logo's accessibility (`aria-hidden` now
  only on the SVG; key renamed to `app.logo.homeLink`), and marked the ops
  docs' `kosmos` names as post-cutover targets.
- Added the [Kosmos rename PRD](../specs/kosmos-rename/PRD.md) as the WHY/WHAT
  companion to the implementation plan.
- Wrote the cutover tooling: idempotent
  [`deployment/provision.sh`](../../deployment/provision.sh) (new-env
  provisioning and rename convergence in one script) and the temporary
  [`deployment/cutover-teardown-old-name.sh`](../../deployment/cutover-teardown-old-name.sh).

## Decisions

- Product, technical naming, example preservation, availability, and external
  cutover decisions are recorded in the
  [Kosmos rename PRD](../specs/kosmos-rename/PRD.md#decisions-made) and
  [implementation plan](../specs/kosmos-rename/implementation-plan.md#decisions).
- The V1 product PRD stays wedding-framed as a point-in-time record; only
  current-facing docs are repositioned.
- Cutover ordering: merge → repo rename → `provision.sh` immediately after
  (the WIF condition breaks CI between those two steps) → OAuth console →
  verify → teardown.

## Learnings / tensions surfaced

- Wedding planning remains a representative project type; general positioning
  does not require replacing wedding-oriented tests or seed data.
- The available browser MCP sandbox blocks both Chromium's macOS rendezvous and
  localhost CDP connections, so automated visual inspection could not be
  completed despite the application building and Chromium launching externally.
- The GitHub app could not access the private repository; authenticated `gh` was
  used to open the draft PR after the branch was pushed.

## Status at end of session

Draft PR #62 contains the repository-safe Kosmos rename, reviewed and with all
findings actioned; validation is green apart from browser visual inspection
(now tracked as the PRD's open question on brand-mark theming plus a
post-merge visual pass). After merge, the remaining work is the external
cutover: `deployment/provision.sh` right after the repository rename, manual
OAuth console steps, verification, then
`deployment/cutover-teardown-old-name.sh`.
