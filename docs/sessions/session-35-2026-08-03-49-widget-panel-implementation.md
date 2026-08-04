# Session 35 — #49 widget panel implementation (2026-08-03)

## What was done

- Executed the approved #49 build plan end-to-end as an orchestrator: all
  twelve commits (C1–C12) landed on `feat/49-widget-panel`, PR
  [#52](https://github.com/jeremy-dardour/wedding-planner/pull/52) opened
  (draft mid-flight per user request, flipped to ready at closeout);
  placeholder PR #51 closed.
- Wave 1 (C1–C6 + C11) ran as seven parallel Opus implementer agents in
  isolated worktrees; waves 2–5 (C7–C10) as sequential agents directly on the
  branch. Every diff was orchestrator-reviewed against the plan section and
  standards, gated (`check-types`/`lint`/full web suite) and committed by the
  orchestrator; agents never committed. 344 web tests green at tip.
- Visual verification after C9 via Playwright MCP on own dev servers (user's
  had stopped): light + dark, rail toggle + localStorage persistence across a
  server restart, stats vs seed, owner-filter mirroring with muted zero
  chips, next-deadline click-through + hover ring, C11 button treatment.
  Screenshots shared in-session.
- Handled three review rounds in-branch: user's five inline PR comments
  (answered in a top-level PR comment; `selection.types.ts` rename +
  standard), two batch reviews (three Low findings fixed: Selection module
  extraction, tomorrow countdown case, `widgets/` folder standard), and a
  final two-axis `/code-review` of the unreviewed tail (3 real issues fixed
  in `04ad7ac`, 5 judged not-issues with reasons on the PR thread and in
  session chat).
- C12 closeout: `docs/current-state.md` refreshed, `build-plan.md` +
  `orchestrator.md` deleted, PR description finalized with the
  folder-choice + seam decisions.
- Incidental: ran `db:migrate:up` on the dev database (it was behind main's
  #40 migrations, 500-ing the overview aggregate).

## Decisions

- **`widgets/` subsystem folder codified** — the settled plan placement was
  persisted into [apps/web/STANDARDS.md](../../apps/web/STANDARDS.md)
  (feature-hosted subsystem folders) rather than restructuring, mirroring
  the #40 deviations-into-standards pattern.
- **Type-only modules get a `.types.ts` suffix** — user review decision,
  codified in [STANDARDS.md](../../STANDARDS.md) (file naming).
- **First CLDR plural keys** — `overview.widgets.groupsHidden_*` with
  `_many` optional in the `Translations` interface (English never selects
  it); rationale recorded in
  [apps/web/src/types/i18n.ts](../../apps/web/src/types/i18n.ts).
- Client-side stats derivation reaffirmed against a "move to backend?"
  review question — the panel mirrors client-side filters; recorded in the
  PR #52 conversation (settled originally in issue #49).

## Learnings / tensions surfaced

- **Node 25 shadows jsdom's `localStorage`** in vitest with an unusable `{}`
  global (`sessionStorage` is unaffected). Specs needing storage must stub an
  in-memory `Storage` via `vi.stubGlobal`; without it, persistence tests pass
  vacuously. Pinned in `use-local-storage-state.spec.ts` and the panel
  integration spec.
- **Base UI 1.6 tooltip facts**: `Tooltip.Provider` is optional (shared-delay
  only); delay props live on `Trigger`, not `Root`; `aria-describedby` is
  wired only while open, so icon-only triggers still need `aria-label`.
- Base UI dropdown quirk in jsdom: a menu won't reopen from a plain second
  click while the pointer rests where the last click closed it — the panel
  integration spec routes reopening through a click-elsewhere-first helper.
- Orchestration friction worth remembering: `git add -A` at commit time swept
  a stray Playwright screenshot into a commit (removed in a follow-up; save
  screenshots under `.playwright-mcp/` or the scratchpad only), and a
  worktree agent's `git mv` staged ahead of an unrelated commit, splitting a
  rename across two commits. Force-push to repair was declined — append-only
  fixes instead.
- User workflow preferences surfaced mid-run: subagents are fine (the
  concern was losing in-flight work to the 5-hour limit — worktrees + commit
  -as-you-go answer it); PR opened early with a live progress checklist
  rather than at closeout; orchestrator (not implementers) owns gates,
  commit messages, and visual verification.

## Status at end of session

#49 is implemented and fully reviewed: PR #52 (21 commits) is ready for the
user's review, with both review axes clean of actionable findings. Placeholder
PR #51 is closed; `temp-from-proto-2` remains as prototype reference until
#50. Next: user review + squash-merge of PR #52, then deployment
([#26](https://github.com/jeremy-dardour/wedding-planner/issues/26), picking
up the noted `NULLS NOT DISTINCT` migration), then #50 (calendar + agenda
widgets). Live status: [docs/current-state.md](../current-state.md).
