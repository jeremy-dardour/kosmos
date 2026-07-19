# Domain Docs — consumer rules

How the engineering skills should _consume_ this repo's domain documentation.
This repo is **single-context** (one root `CONTEXT.md` + one `docs/adr/`).

This file is deliberately **not** an inventory of the docs — that has a single
home: the **Documentation map** in [CLAUDE.md](../../CLAUDE.md), which is always
loaded. Start there to learn which docs exist and what each holds. Everything
below is only the consumption rules the map doesn't cover.

## Before exploring

Read `CONTEXT.md` (the glossary) and any `docs/adr/` entries that touch the area
you're about to work in, following the Documentation map. If a referenced doc
doesn't exist yet, **proceed silently** — don't flag its absence or propose
creating it upfront. `/domain-modeling` (via `/grill-with-docs`) creates and
extends these lazily as terms and decisions get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a refactor proposal, a
hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to
synonyms the glossary avoids (it's a **Workstream**, not a "track"; **advance**,
not "complete-and-move").

If the concept you need isn't in the glossary, that's a signal — either you're
inventing language the project doesn't use (reconsider), or there's a real gap
(note it for `/domain-modeling`).

## Flag ADR / decision conflicts

If your output contradicts an existing ADR or a row in
`docs/domain-decisions.md`, surface it explicitly rather than silently
overriding:

> _Contradicts ADR 0005 (pipeline state machine) — but worth reopening because…_
