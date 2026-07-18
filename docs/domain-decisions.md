# Domain Decisions

The single home for **domain / product design decisions** and their rationale
(technical/architectural decisions live in [docs/adr/](./adr/) instead).

Append-only — add a new numbered row when a domain decision is made; mark
superseded rows rather than deleting them. The entities and rules in
[CONTEXT.md](../CONTEXT.md) always reflect the *current* outcome of this table.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | No standalone tasks — every work item is a Step inside a Workstream | One consistent model; avoids orphan work with no pipeline context |
| 2 | Pipeline model — Steps strictly ordered, Workstream has a current position | Wedding prep is largely sequential; "advance" is the core interaction |
| 3 | No parallel steps within a Workstream — parallelism lives at Workstream level | Avoids intra-pipeline complexity; use separate Workstreams + dependencies |
| 4 | Step statuses: Not Started, In Progress, Done, Skipped, Blocked | Minimal set covering pipeline position plus exceptions |
| 5 | Blocked does not prevent advancing — it is informational | Soft-flag and hard-gate collapse to the same behavior; advancing forces a Done/Skipped choice |
| 6 | Single owner per Step | Clear accountability; simpler than multi-owner |
| 7 | Workstream-level default owner, inherited by Steps | Avoids repeating the owner on every step |
| 8 | Group is a visual label/tag/color only | Clustering and sorting on the overview; no behavior needed |
| 9 | No separate "unordered" workstream mode — use Checklist Steps | One pipeline model with a checklist escape hatch |
| 10 | Checklist sub-items are lightweight (name + done/skipped only) | Full step machinery (owner/deadline/links) is unnecessary for sub-items |
| 11 | Dependencies are visual-only, no enforcement | Real dependencies are fuzzy; enforcement adds friction without value at this scale |
| 12 | Dependency granularity is Workstream → Workstream | Step-level dependencies are too granular for the overview |
| 13 | Overview shows each Workstream as its full pipeline, color-coded by status | See all work and its status at a glance |
| 14 | ~~Deadline-steps anchored on a shared time axis~~ | *Superseded by Decision 24 — a shared axis didn't scale to 20–50 rows* |
| 15 | No milestone flag — any step with a deadline is implicitly a milestone | Avoids a redundant concept |
| 16 | Links only in V1 (URL + label), no file uploads | Uploads add storage/complexity; URLs cover Drive docs, vendor sites, contracts |
| 17 | Notes are an append-only timestamped log, not a single field | Preserves the history of decisions and interactions |
| 18 | All users equal in V1 (no roles) | 2–6 trusted users; roles are premature. Future: admin + workstream-owner roles |
| 19 | Access control via in-app email whitelist, not Google Groups | Consumer Gmail Groups API access is awkward; a whitelist is simpler |
| 20 | Overview layout: two-panel "Pipeline Stack" — grouped cards left, slide-over detail right | Chosen in the wireframe prototype (turn 3 / option 3a) over alternatives |
| 21 | Advance directly from the card; richer edits (notes, links, owner) in the detail panel | Keep the most frequent action one-click; focus the detailed edits |
| 22 | Detail view is a slide-over panel, not a separate page or inline expand | Keeps overview context visible while drilling into one workstream |
| 23 | Dependencies shown as a "depends on" text list in the detail panel | Arrows (explored in wireframe 1a) cluttered the 20–50 workstream overview |
| 24 | Deadlines shown as a per-card countdown badge + date-ticks; 7-day urgency threshold (red < 7d, grey ≥ 7d, solid red overdue). No shared time axis | A shared time axis didn't scale to 20–50 rows; per-card countdown reads clearer |
| 25 | Each Workstream has an icon | Quick visual identification in the card list |
