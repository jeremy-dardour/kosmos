# Sessions

One dated summary per working session — an append-only history of what was done,
what was learned, and the status at the time. These are immutable records: don't
edit past sessions when things later change.

- **Naming:** `session-NN-YYYY-MM-DD-slug.md`
- **Link, don't restate:** product decisions live in the
  [V1 Product PRD](../specs/v1-product/PRD.md); technical decisions in
  [../adr/](../adr/); live status lives in
  [../current-state.md](../current-state.md).

## Template

Copy this into a new `session-NN-YYYY-MM-DD-slug.md` at session start and fill it
in as you go; finalize it at session end.

```markdown
# Session NN — <title> (YYYY-MM-DD)

## What was done

- <concrete actions taken this session>

## Decisions

- <product decisions → link to the V1 PRD section they affect;
  technical decisions → ../adr/. Write "None" if the session made none.>

## Learnings / tensions surfaced

- <non-obvious things learned, trade-offs weighed, dead-ends — skip if none>

## Status at end of session

<one short paragraph: current phase + what's next. Then mirror this into
../current-state.md, which is the live source of truth for status.>
```

How to fill it: keep bullets terse and factual; **link, don't restate** —
product decisions live in the V1 PRD, technical decisions in `../adr/`, live
status lives in `../current-state.md`. The session file is an immutable record
of _what happened_, so don't edit past sessions when things later change.
