# Session 10 — Wayfinder Close-Out, Tech Design & Build Slices (2026-07-23)

## What was done

- **Audited the V1 Product PRD** for what/why purity. Found it clean — no
  implementation details leaking in. One contradiction found and fixed: empty
  workstream behavior (PRD said "start → complete," ticket 09 draft said "reject
  with 409"). Resolved to 409 rejection — completing with zero work masks a
  setup mistake.

- **Challenged and resolved ticket 09 — State machine implementation:**
  - **Unified `advance` endpoint:** merged `POST start` and `POST advance` into
    a single `POST /workstreams/:id/advance`. Server dispatches by lifecycle.
    Simpler API surface — caller's intent is always "move forward."
  - **No separate state-machine class:** private methods on `WorkstreamService`,
    pure utility functions for derived state. Premature abstraction at this scale.
  - **Explicit transactions for advance + step reorder only.** Everything else
    relies on MikroORM's unit-of-work flush.
  - **Circular FK (`currentStepId`) is a non-issue** — RESTRICT prevents DELETE,
    not UPDATE. Mutations are UPDATEs in one transaction.
  - Updated API contract PRD, ADR 0005, and V1 Product PRD to match.

- **Resolved ticket 08 — Sequence V1 into ordered increment-specs.** Decomposed
  V1 into end-to-end build slices (not horizontal backend-then-frontend).

- **Created 10 GitHub issues** (#17–#26) as end-to-end slices:
  - Slice 0: Entities + migration (#17)
  - Slice 1: Layout shell + overview + cards (#18) — includes UI foundation
    (CSS custom properties / design tokens from wireframe)
  - Slice 2: Detail slide-over read-only (#19)
  - Slice 3: Advance + start (#20)
  - Slice 4: Deadline badges + filters (#21)
  - Slice 5: Notes write actions (#22)
  - Slice 6: Checklist + step edits (#23)
  - Slice 7: Workstream + group management (#24)
  - Auth: Google OAuth (#25) — independent
  - Deployment: Cloud Run + Neon (#26) — independent, non-blocking
  - Closed previous 12 issues (#5–#16) that used horizontal slicing.

- **Wrote the V1 Technical Design doc** (`docs/specs/v1-tech-design.md`) linking
  schema, API contract, state machine, auth, deployment, and the build sequence
  with issue references.

- **Wayfinder map complete** — all 9 tickets resolved. Planning phase finished.

- **Deleted the wayfinder** (`docs/wayfinder/`) — all information had graduated
  to proper homes (PRD, tech design doc, spec docs, research docs, GitHub
  issues). Updated all references in CLAUDE.md, current-state.md, tech design
  doc, agent docs, and research docs.

## Key decisions

- **Single `advance` endpoint** over separate `start`/`advance` — the caller
  doesn't need to know the lifecycle state to choose the right URL.
- **End-to-end slices** over horizontal (all-backend → all-frontend) — each
  slice produces a visible result, better for agent implementation and testing.
- **No separate design system issue** — UI foundation (design tokens from
  wireframe) baked into Slice 1 (#18) as CSS custom properties.
- **Empty workstream → 409** — can't start with zero steps.

## Learnings

- End-to-end slices force better thinking about what's actually needed per
  feature — the horizontal split had backend endpoints that couldn't be verified
  until the UI existed 4 issues later.
- The "one API action vs two" debate resolved cleanly once the question was
  reframed from "what's correct" to "what's simpler for the caller." The domain
  model keeps separate transitions internally.

## Status after session

**Ready to build.** No open design questions. 10 GitHub issues in build order.
First issue: #17 — Entities + initial migration.
