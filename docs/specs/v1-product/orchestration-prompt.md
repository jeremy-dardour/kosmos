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
