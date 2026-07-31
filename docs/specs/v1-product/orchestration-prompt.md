# Orchestration prompt — #40 implementation

Paste this into a fresh session to run the implementation as an orchestrator.
Delete this file once #40 is merged.

---

**Orchestrate the implementation of #40 (inline overview rework). You
coordinate and review; Opus 5 implementer subagents write the code.**

Load context first, in this order:

1. `docs/specs/v1-product/overview-rework-plan.md` — the work order: one PR
   from `prototype-2` → `main`, twenty ordered commits C1–C20, each green
   (`pnpm check-types && pnpm lint && pnpm test`, plus
   `pnpm --filter api test:e2e` for API commits) with tests landing in the
   same commit.
2. `docs/prototype/overview-editing/HANDOFF.md` — the normative behaviour
   spec (appendix A1–A16; §9 gotchas; §10 component map).
3. `docs/specs/v1-product/api-contract.md` — exact endpoints, DTOs, error
   slugs, cache rules.
4. `git log --oneline -10` + `docs/current-state.md` — establish which
   commits are already done and resume from the next one.

Orchestration rules:

- Dispatch work to implementer agents in plan order — one commit (or one
  phase's tight cluster) per agent task. Give each agent only its commit's
  plan entry, the handoff sections the plan cites for it, and the contract
  section it touches. All decisions are made — instruct agents to never
  reopen them.
- After each agent returns: review the diff yourself against the handoff
  spec and repo standards, run the gates, then commit. You own commit
  messages and the green-per-commit invariant, not the agents.
- Enforce the sequencing traps the plan encodes: whole-tail `PUT /pipeline`
  dies only in C18; `OverviewPage` stays router-free; no Playwright tests;
  regenerate api-types in every route/DTO commit; ports from `PORTS.md`;
  i18n (en/fr/es) in the same commit as new copy.
- The prototype (`/?variant=A`) is the visual reference — behaviour, never
  structure. Verify Phase C commits visually with Playwright MCP against the
  running app.
- When all of C1–C20 are green: open the PR to `main` referencing #40, then
  stop for my review.

Session facts (kept current by the orchestrator — read on restart):

- **Work branch: `feat/40-overview-rework`** (created from `prototype-2`,
  design/docs commits squashed to one; PR #48 open with a live checklist —
  keep it ticked as commits land). Resume point = first plan commit not
  present in `git log --oneline`. **Phases A (C1–C7) and B (C8–C10) are fully
  landed**; resume at C11. The save-model seam is `src/api/overview-cache.ts`
  (`useOverviewCache`) — Phase C hooks commit through it, never per-mutation
  invalidation.
- Gates per commit: `pnpm check-types && pnpm lint && pnpm format:check &&
pnpm test`, plus `pnpm --filter api test:e2e` for API commits. Web
  typecheck: trust only `tsc -b --force` (incremental buildinfo false-passed
  once after generated-type changes).
- Agents must not touch the user's running dev processes; regenerate
  api-types against a temporary built API instance on a free port.
- Amended premises agents must not "re-fix": position unique constraints ARE
  `deferrable initially deferred`; ordered renumbering is single-phase (no
  temporary positions) — see ADR 0008, api-contract §Manual ordering, and
  C3–C6 for the established idioms (`step-mutability.util`,
  `lock-workstream-graph.query`, `touchWorkstream`, `isExactMembership`).
- The API and web apps are **already running** on the ports in the `.env`
  files — agents must not start their own servers or database, and use the
  running API for `pnpm generate:api-types`.
- Implementer briefs follow the `/implement` skill style (TDD at clear seams,
  typecheck/lint/targeted tests continuously, full gates at the end) but
  agents **never commit** — the orchestrator reviews, runs gates, commits.
- Each brief carries: the commit's plan entry verbatim, the handoff/contract
  excerpts it needs, an **explicit non-goals list** (no scope creep, no
  overengineering, no speculative seams), and a strict comment rule (no
  narration; only real edge cases, workarounds, constraints, or public API
  docs). The orchestrator's review checks spec conformance, repo standards,
  module depth (per the codebase-design skill), and trims comment noise.
- An untracked personal `todo.md` sits at the repo root. It must **never be
  staged or committed** (contains private information; the repo may go
  public).
- Known flake: two date-sensitive `project-crud` e2e tests failed once during
  C1 (unreproducible in 25+ reruns, pre-existing date fragility). Not caused
  by this branch; watch for recurrence.
- At ~400k context or a phase boundary, the orchestrator checkpoints: run
  `log-session`, refresh `docs/current-state.md`, and update this section so
  a fresh session can resume cleanly.
