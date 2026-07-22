<!-- wayfinder:grilling -->

# Overview UI build slices

Type: grilling
Status: resolved

## Question

Given the API contract (ticket 04) and the chosen **Pipeline Stack** prototype
([docs/prototype/timeline/](../../prototype/timeline/); Decisions 20–24), slice
the web build into buildable increments (design is already decided — this is
build-order, not redesign).

## Resolution

Seven ordered UI increments. Each is self-contained — renders something testable
on screen before the next begins. Data-fetching follows the existing pattern
(`openapi-react-query` with `$api.useQuery` / `$api.useMutation`, thin hook
wrappers in `src/api/hooks/`). i18n is **English-first** (`en` primary, `fr`
secondary).

### Slice 1 — Layout Shell + Overview Data

- Two-panel layout (left scrollable card list, right placeholder panel)
- Header bar: app title + global countdown badge (days until event date)
- Wire `GET /projects/:id/overview` via `openapi-react-query`
- Loading and empty states

### Slice 2 — Workstream Card List

- Cards grouped by Group (section headers with color swatch + Ungrouped bucket)
- Card content: icon + workstream name + owner avatar (initials circle)
- Pipeline dots row: status-colored circles (Done green, In Progress blue with
  glow, Not Started grey outline, Skipped dashed, Blocked red with glow),
  connecting lines, step name labels below each dot
- Lifecycle rendering: NotStarted / Active / Complete visual states on cards

### Slice 3 — Detail Slide-Over (read-only)

- Click card → right panel opens with workstream detail
- Vertical step pipeline: status dots, "CURRENT" badge on active step, done
  steps with strikethrough text + completion date
- Steps with deadlines show date + relative countdown
- Checklist sub-items display (read-only checkboxes, completion count badge)
- Notes section (read-only, reverse-chronological) — loads via
  `GET /workstreams/:workstreamId/notes` when panel opens
- Selected-card visual treatment (blue border, light blue background)
- Close button (✕); clicking another card swaps

### Slice 4 — Pipeline Actions (advance / start)

- "Advance →" button on cards → `POST /workstreams/:id/advance`
- Outcome selection: Done (default) vs Skipped
- "Start" action on NotStarted workstreams → `POST /workstreams/:id/start`
- Blocked card treatment: red border, "BLOCKED" badge next to name,
  "Resolve ▾" dropdown with "Mark Done" / "Mark Skipped"
- Refetch overview after mutation

### Slice 5 — Deadline Badges + Filters

- Per-card countdown badge: nearest upcoming deadline
  (`"{stepName} in {N}d"`)
- Urgency thresholds: grey (≥ 7d), red badge (< 7d), solid red (overdue)
- Date-tick labels under pipeline dots that have deadlines (urgent in red,
  comfortable in grey; no label if no deadline)
- Overdue card treatment (red border + background)
- Owner filter dropdown ("My Tasks ▾") — filters to workstreams where current
  step owner matches selected user
- Group filter dropdown ("All Groups ▾") — shows/hides groups

### Slice 6 — Notes Write Actions

- Add note: inline text input in detail panel → `POST /steps/:stepId/notes`
- Edit own note → `PATCH /notes/:id`
- Delete own note → `DELETE /notes/:id`
- Author guard: only show edit/delete controls on notes authored by the
  current user

### Slice 7 — Checklist + Step Edits

- Toggle checklist item done/undone → `PATCH /checklist-items/:id`
- Edit step attributes from detail panel: owner, deadline, blocked flag →
  `PATCH /steps/:id`

## Decisions made

- **i18n language:** English-first (`en` primary, `fr` secondary translation).
  The template's fallback language config can stay as-is; `en.json` is the
  source of truth for copy.
- **Data-fetching:** Same pattern as the `items` reference slice —
  `openapi-react-query` wrapping `openapi-fetch`, thin hooks in
  `src/api/hooks/`.
- **Workstream icon:** Left as emoji string for now (the `icon` field on
  `CreateWorkstreamDto` accepts any string up to 255 chars). Visual refinement
  deferred to implementation.
