# Session 03 — Documentation Restructure (2026-07-18)

## What was done

Picked the project back up, audited all handover/context docs for
inconsistencies, and restructured the documentation so every fact has a single
home.

- Audited `CONTEXT.md`, the two handoffs, the session log, and the prototype
  handoff; found 7 inconsistencies (stale timeline concept, reversed dependency
  display, stale open-question lists, wrong persistence suggestion, missing
  `icon`, broken links, and a purpose contradiction with global constraints).
- Confirmed the project is a real tool for active use (see
  [project-purpose.md](../project-purpose.md)).
- Reconciled `CONTEXT.md` with the chosen prototype and captured the reasoning
  in a dedicated [domain-decisions.md](../domain-decisions.md) (the single home
  for domain decisions + rationale), including new Decisions 20–25 and marking
  Decision 14 superseded.
- Split context into single-purpose docs: `project-purpose.md` (why),
  `current-state.md` (where we are), `domain-decisions.md` (design rationale),
  and per-session summaries here.
- Moved project "memory" in-repo (no external memory store for this project) and
  added a documentation map + conventions to `CLAUDE.md`.
- Deleted superseded journals: `matt-handoff-…md`, `initial-prompt.md`,
  `docs/domain-handover.md`.

## Decisions

No new _domain_ decisions. Documentation conventions established (see
`CLAUDE.md`): single-home-per-fact; live state in `current-state.md`; append-only
domain decisions in `docs/domain-decisions.md`; one dated session summary per
session named `session-NN-YYYY-MM-DD-slug.md`; project memory lives in-repo.

## Learnings / tensions surfaced

- The staleness all came from **journal-style docs** (handoffs, dated logs)
  re-stating durable truth. Fix: journals record only what happened + learnings
  and link to the single-home docs for current truth.

## Status at end of session

Documentation coherent and reconciled. Project state unchanged: still
pre-implementation. Next: close the three open questions in `current-state.md`,
then data-model design.
