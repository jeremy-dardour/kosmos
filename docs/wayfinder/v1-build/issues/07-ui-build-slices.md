<!-- wayfinder:grilling -->
# Overview UI build slices

Type: grilling
Status: open
Blocked by: 04

## Question

Given the API contract (ticket 04) and the chosen **Pipeline Stack** prototype
([docs/prototype/timeline/](../../prototype/timeline/); Decisions 20–24), slice
the web build into buildable increments (design is already decided — this is
build-order, not redesign).

Decide the slices and their order across:
- **Overview** — grouped Workstream cards, color-coded status, Ungrouped bucket.
- **Advance interaction** — the one-click advance + skip from the card (Decision
  21), outcome selection, NotStarted `start`.
- **Detail slide-over** — steps, owners, deadlines, the note thread (editable,
  clickable URLs), checklist sub-items, `blocked` flag.
- **Deadlines** — per-card countdown badge + date-ticks (Decision 24) and the
  global event-date countdown (Decision 37).
- **States** — NotStarted/Active/Complete rendering; empty/loading.

Also decide: data-fetching approach (React Query, pull-based — Decision 27),
following the `apps/web/src/features/items` reference; and **UI language / i18n**
(graduate the fog item).

Output: an ordered set of UI increments. Input to _Sequence V1_.
