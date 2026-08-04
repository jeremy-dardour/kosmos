# Session 36 — #50 calendar + agenda widgets (2026-08-03)

## What was done

- Planned and executed [#50](https://github.com/jeremy-dardour/wedding-planner/issues/50)
  end-to-end as an orchestrator, continuing on `feat/49-widget-panel` so PR
  [#52](https://github.com/jeremy-dardour/wedding-planner/pull/52) covers both
  widget tickets (user's call). The build plan lives as a
  [PR comment](https://github.com/jeremy-dardour/wedding-planner/pull/52#issuecomment-5170525804)
  rather than a committed file.
- Two exploration agents front-loaded the plan: one mapped the #49 seams
  (contracts, persistence, i18n plural pattern, test harness), one extracted
  the prototype's grid/agenda algorithms and pitfalls from
  `temp-from-proto-2` (date-string discipline, the rAF scroll race, anchor
  namespacing, hardcoded-English inventory).
- Ten commits landed (C13–C20 + two review commits), every diff
  orchestrator-reviewed and gated (`check-types`/`lint`/full web suite)
  before committing; agents never committed. Waves: C13/C14/C15 as three
  parallel Opus worktree agents, C16/C17 as two parallel worktree agents
  (conflict-free because C15 owned every shared-file i18n edit), C18/C19
  sequential on the branch. 405 web tests at tip.
- Visual verification after C18 and re-check after the refactor (Playwright
  MCP, own servers): light + dark, grid marks/today ring vs seed, month nav,
  overdue-month jump landing on the agenda's Overdue block, agenda entry
  click opening the exact step editor with the card centred, filter
  mirroring.
- Four review passes after C19 (user-requested set): two-axis `/code-review`
  (standards + spec vs issue #50), a security review of the whole branch
  diff, and a simplification review run under the codebase-design skill.
  Outcomes: spec found one real bug (today ring on out-of-month cells →
  fixed in `ffef401`); security found nothing actionable; eight
  simplification/standards findings actioned in `ee05703`; the rest
  rejected with reasons recorded in the PR description.
- C20 closeout: `docs/prototype/widget-panel/` deleted, PR #52 retitled and
  its description extended to close both tickets (a duplicated tail block in
  the old body was cleaned up in passing), branch pushed.

## Decisions

- **Grid→agenda jump = pending-anchor state + post-commit effect**, not the
  prototype's `requestAnimationFrame` (which raced section mounting); a
  marked day whose month has no upcoming bucket jumps to the overdue block's
  own anchor. Recorded in the PR #52 description.
- **Only marked in-month days are interactive**; day tooltips stay native
  `title` (ticket) with full `aria-label`s; no `role="grid"`.
- **Month/weekday names via `Intl.DateTimeFormat`** (`calendar-locale.ts`,
  following `format-deadline-date.ts`'s `locale?: string` convention);
  Monday-first is a constant, not `Intl.Locale.weekInfo`.
- **Agenda section identity lives in `agenda-buckets.ts`**
  (`OVERDUE_SECTION`, `agendaAnchorId`, `agendaSectionOf`) and
  **`derivePulseStats` consumes the agenda buckets** — pulse and agenda can
  never disagree about late/next (post-review refactor).
- **One `urgency-classes.ts` at the overview feature root** now holds the
  text + dot band maps; `pipeline-row` derives from it (its former
  `BAND_COLORS` literal was a character-identical copy).

## Learnings / tensions surfaced

- **Agent worktrees were created off `main`, not the current branch** — all
  five wave-1/2 worktree agents found themselves at `6bec1b3` and had to
  `git reset --hard feat/49-widget-panel` first. Later briefs made that
  check explicit; worth pre-checking in any future worktree-wave brief.
- **Concentrating all i18n key edits in one early commit** (C15) is what let
  the two component agents run in parallel worktrees with zero merge
  conflicts — the shared-file bottleneck was designed out at plan time.
- Repo lint shapes test idioms: `unicorn/prefer-query-selector` forbids
  `getElementById` (a simplification finding was rejected on this),
  `set-state-in-effect` rules forced the jump state to a fresh-object
  `{ anchorId }` per pick instead of null-after-scroll.
- A `useMemo` whose deps include the page's per-render `now` clock never
  hits; two such memos were dropped in review — memoizing on `now` just
  advertises false stability.
- The spec reviewer's "past-year deadline shows its year in the month
  header" scenario is unreachable by construction (past-year ⇒ overdue ⇒ no
  month header); the test asserts the honest neighbours instead.

## Status at end of session

#50 is implemented, four-way reviewed, and pushed: PR #52 now spans both
widget tickets (31 commits, `Closes #49` + `Closes #50`), gates green with
405 web tests, prototype record deleted. Awaiting the user's review and
squash-merge; `temp-from-proto-2` dies after the merge. Next milestone:
deployment ([#26](https://github.com/jeremy-dardour/wedding-planner/issues/26)),
picking up the noted `NULLS NOT DISTINCT` migration. Live status:
[docs/current-state.md](../current-state.md).
