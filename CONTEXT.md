# Domain Glossary

## Core Entities

### Workstream
A named track of wedding preparation work (e.g., "Venue", "Catering", "Flowers"). Has a name and an icon for quick visual identification. Contains an ordered sequence of Steps forming a pipeline. Has a default Owner, belongs to a Group, and can declare dependencies on other Workstreams.

### Step
An individual action within a Workstream's pipeline. Steps are strictly ordered. A Step has: name, status, optional deadline, optional owner (inherits from Workstream if unset), a note log, and links.

### Checklist Step
A Step variant that contains multiple sub-items (e.g., "Visit venues" → { Château A, Château B, Château C }). All sub-items must be completed or skipped before the Workstream can advance past this step. Sub-items are lightweight: name + done/skipped toggle only (no owner, deadline, or attachments).

### Group
A visual/organizational label on a Workstream used for clustering and sorting on the overview. No behavior, no roll-up status. Think: color + tag.

### Dependency
A visual-only directional link between two Workstreams (Workstream → Workstream). Listed as a "depends on" text entry in the workstream's detail panel — arrows on the overview were explored but dropped ([decision 23](./docs/domain-decisions.md)). No enforcement, no warnings, no step-level granularity.

### Note Entry
A timestamped text entry in a Step's log. Notes are append-only (a thread of entries, not a single overwritable field). Records history of interactions and decisions.

### Link
A URL + label attached to a Step. No file uploads in V1 — external resources (Drive docs, vendor sites, contracts) are referenced by URL.

### User
A person identified by their Google email address, authenticated via Google OAuth. All users have equal access (no roles in V1).

## Statuses (Step)

| Status | Meaning |
|--------|---------|
| Not Started | Ahead of current position in pipeline |
| In Progress | The current step being worked on |
| Done | Completed (completion date recorded automatically) |
| Skipped | Intentionally bypassed (date recorded automatically) |
| Blocked | Stuck/waiting — informational flag, does not prevent advancing |

## Key Rules

- **Pipeline model**: Steps are ordered. A Workstream has a "current position" pointer. The primary interaction is "advance."
- **Advancing from Blocked**: User chooses to mark the step Done or Skipped, then advances.
- **Deadlines = milestones**: No separate milestone flag. Any step with a deadline is implicitly a milestone. Deadlines surface as a per-card countdown badge plus date-ticks under the relevant step dots ([decision 24](./docs/domain-decisions.md)), not on a shared time axis. At minimum, the last step of every Workstream has a deadline.
- **Completion dates**: Automatically recorded when a step is marked Done or Skipped.
- **Ownership inheritance**: Steps inherit the Workstream's default owner unless explicitly overridden.
- **Parallelism**: Handled at the Workstream level (separate workstreams + dependencies), not within a pipeline — except via Checklist Steps for unordered sub-items within a single step.
- **Access control (V1)**: Email whitelist in the app. Google OAuth for identity, app checks if email is in the allowed list.

---

The reasoning behind these entities and rules — the numbered domain decisions
referenced above — lives in [docs/domain-decisions.md](./docs/domain-decisions.md).
