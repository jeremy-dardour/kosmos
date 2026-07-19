# Session 05 — Agent tooling, wayfinder map & privacy (2026-07-19)

## What was done

- Closed the last domain-model thread carried over from session 04 —
  **dependencies → no Dependency entity** ([Decision 36](../domain-decisions.md));
  the V1 domain model is now complete (Decisions 26–40, see
  [session 04](./session-04-2026-07-18-domain-modeling.md)).
- Ran `/setup-matt-pocock-skills`: chose a **local-markdown issue tracker
  committed under `docs/`** (PRDs → `docs/specs/`, wayfinder maps →
  `docs/wayfinder/`), default triage labels, single-context domain docs. Wrote
  `docs/agents/{issue-tracker,triage-labels,domain}.md` + an `## Agent skills`
  block in `CLAUDE.md`.
- Charted the **V1-build wayfinder map** ([docs/wayfinder/v1-build/](../wayfinder/v1-build/map.md)):
  a *planning* destination — decompose V1 into buildable increment-specs — with
  8 tickets (frontier: 01 schema · 02 auth research · 03 hosting research).
  Deployment / hosting / CI folded into scope on request.
- Enriched the two AFK research tickets with owner context: **auth** (research
  all three allow-list mechanisms; personal-Gmail / no-Workspace-domain fact;
  may revise Decision 26) and **hosting** (AWS free-tier a serious option; compare
  both frontend-serving strategies; decision deferred to ticket 06).
- Settled subagent config for the research tickets (general-purpose, Sonnet 5,
  in-place, web search on) — **not yet launched**.

## Decisions

- **Domain:** [Decision 36](../domain-decisions.md) — no Dependency entity in V1
  (closes the last open thread; full set 26–40 recorded in session 04).
- **Process / tooling** (not domain decisions): local-markdown issue tracker under
  `docs/`; wayfinder *planning* destination for the V1 build. See
  `CLAUDE.md` § Agent skills and the map.

## Learnings / tensions surfaced

- **Single-home discipline caught a live duplication** — `docs/agents/domain.md`
  had re-listed the domain docs that `CLAUDE.md`'s documentation map already owns.
  Fixed by splitting the doc *inventory* (map) from the *consumption rules*
  (domain.md).
- **Privacy:** personal info (partner's name, career/life plans) must never reach
  a repo that might become public. Scrubbed the partner's name (never committed),
  and put the guardrail where it belongs — global `~/.claude/CLAUDE.md` Privacy
  rule + this repo's `CLAUDE.md` Visibility note — **not** in-repo memory, which
  would defeat the purpose.
- Config vs procedure: the matt-pocock per-repo settings live in `docs/agents/` +
  a `CLAUDE.md` index, not in a skill — skills are shared procedures, repo answers
  live with the repo.

## Status at end of session

Pre-implementation, **domain model complete**; now **planning the V1 build** via
the wayfinder map. No code written. Next: work the map one ticket per session —
grill **ticket 01** (data-model & schema) or launch the AFK research tickets
(**02** auth, **03** hosting) on Sonnet 5.
