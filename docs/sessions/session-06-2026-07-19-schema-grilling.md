# Session 06 — Schema grilling + research agents (2026-07-19)

## What was done

- **Spawned two Sonnet research agents** (tickets 02 & 03 from the
  [V1-build wayfinder map](../wayfinder/v1-build/map.md)), both completed:
  - Auth internals & Google OAuth → [docs/research/auth-internals.md](../research/auth-internals.md)
  - Hosting & deploy options → [docs/research/hosting-deploy.md](../research/hosting-deploy.md)
- **Grilling session on Ticket 01** (data-model & schema) — resolved all 16
  design questions. See "Decisions" below for the full list.
- **Wrote the entity/schema design document**
  ([docs/entity-schema-design.md](../entity-schema-design.md)) — the Ticket 01
  output. Covers all 7 entities, constraints, cascades, indexes, and module
  layout. Ticket 01 marked done.

## Decisions

All schema-level; no new domain decisions or ADRs written yet — these feed into
the entity design that Ticket 01 will produce.

| #   | Topic                          | Decision                                                                                                                                                                                    |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Step position uniqueness       | `UNIQUE (workstream_id, position) DEFERRABLE INITIALLY DEFERRED`                                                                                                                            |
| 2   | Position strategy              | Contiguous, 1-indexed. Renumber-the-tail on every insert/reorder/delete.                                                                                                                    |
| 3   | Checklist sub-items            | Separate `ChecklistItem` entity (own table, FK to Step, contiguous 1-indexed position, `name`, `done` boolean). Same position pattern as Step (deferrable unique on `(step_id, position)`). |
| 4   | Step `outcome` type            | Postgres enum (`done`, `skipped`).                                                                                                                                                          |
| 5   | `blocked` flag on advance      | Leave as-is (not auto-cleared) — serves as historical record.                                                                                                                               |
| 6   | Note text column               | `text` type; max length validated in the input DTO only.                                                                                                                                    |
| 7   | User PK                        | UUID PK + unique `email` constraint.                                                                                                                                                        |
| 8   | User fields                    | `id`, `email` (unique), `name`, `avatarUrl`, `createdAt`, `updatedAt`. Refresh name/avatar on each login.                                                                                   |
| 9   | Group fields & `color` storage | `id`, `name`, `color` (varchar hex string, e.g. `#4A90D9`), `projectId`, `createdAt`, `updatedAt`. Workstream has nullable FK to Group. Format validated in input DTO.                      |
| 10  | `eventDate` column type        | `date` (not `timestamptz`). Nullable.                                                                                                                                                       |
| 11  | Cascade deletes                | DB-level `ON DELETE CASCADE` down the tree (Project→Workstream→Step→ChecklistItem/Note, Project→Group). `ON DELETE SET NULL` for Group→Workstream and all User FKs.                         |
| 12  | Indexes                        | FK indexes on `note.step_id` and `checklist_item.step_id`. No other extra indexes beyond PK + unique constraints.                                                                           |
| 13  | Entity rename                  | `NoteEntry` → `Note` (table: `note`).                                                                                                                                                       |
| 14  | Module boundary                | One NestJS `workstream` module, one `workstream.service` owning Workstream CRUD and pipeline transitions (`start`/`advance`).                                                               |
| 15  | Sub-entity services            | Separate `step.service`, `note.service`, `checklist-item.service` internal to the workstream module (shallow CRUD, not exported). Controllers call the matching service.                    |
| 16  | ADR scope                      | ADR 0005 is sufficient — no new ADR for the module shape.                                                                                                                                   |

## Open — where the grilling stopped

**All 16 questions resolved.** Entity/schema design document written. Ticket 01
marked done.

## Research agent outputs (not yet reviewed in detail)

### Auth ([docs/research/auth-internals.md](../research/auth-internals.md))

- Google Groups API not viable on consumer Gmail.
- GIS (Google Identity Services) + static/DB allow-list is the front-runner.
- Two Entra-shaped assumptions in the existing code need changing (audience
  format, `scp` claim validation).
- Full details in the research doc; feeds into Ticket 05 (auth approach).

### Hosting ([docs/research/hosting-deploy.md](../research/hosting-deploy.md))

- Cloud Run + Neon + single deployable recommended as strongest fit.
- Existing CI has zero CD — adding it is additive.
- Single-deployable (NestJS serves Vite build) preferred over split frontend
  for this scale.
- Full details in the research doc; feeds into Ticket 06 (deployment approach).

## Learnings / tensions surfaced

- **Parallel Sonnet research agents** are an effective pattern — both completed
  in ~10 min while we grilled, keeping the critical path on the grilling.
  Reuse for future research tickets.
- **File navigability > minimal service count.** The `codebase-design` skill's
  depth lens suggested starting with one service (option C), but Jeremy chose
  sub-entity services (option B) for navigability. For a solo-dev project,
  being able to find code fast matters more than avoiding shallow services.
  Preference to carry forward.
- **Cascade direction on optional/organizational relations needs explicit
  attention.** I defaulted Group → Workstream to CASCADE; Jeremy caught it —
  deleting a visual label should not destroy workstreams. Rule of thumb: if the
  FK is nullable and the relation is "organizational," it's SET NULL.
- `blocked` flag preservation was a useful micro-decision: "does historical
  signal matter?" — yes, for a wedding tool where context is king.

## Status at end of session

Grilling session complete (all 16 questions resolved). Entity/schema design
document written. Two research docs delivered. Next: review research docs
(auth-internals.md, hosting-deploy.md) then continue the wayfinder map (API
contract → auth/deploy decisions → UI slices → sequence increments).

## Suggested skills

- `/grilling` — resume the schema grilling (1-2 questions remain).
- `/codebase-design` — already loaded this session; useful when finalizing the
  module boundary and reviewing the entity design for depth.
- `/domain-modeling` — if any entity questions surface during schema finalization.
- `/close-session` — once grilling is done and the schema design is written,
  close the session properly (update `current-state.md`, extract memories).
