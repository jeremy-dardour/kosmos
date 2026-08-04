# ADR 0010: Overview widgets are presentational; the panel derives client-side

**Status:** Accepted — 2026-08 (settled in the widget-panel prototype grilling
and issues #49/#50; recorded here when the prototype record was retired)

## Decision

The overview widget subsystem (`apps/web/src/features/overview/widgets/`)
obeys three contracts:

1. **Widgets are presentational.** A widget receives already-derived data
   plus optional injected callbacks (`onEntryClick`, `onEntryHover`,
   `onSelectDay`) and never imports navigation, page state, or data-fetching
   hooks. With the callbacks omitted, a widget renders the same layout
   **inert** — no button roles, no handlers. Cross-link behaviour (scroll to
   a card, open a step editor, highlight on hover) is implemented by the
   host page and passed in.
2. **All widget data derives client-side** from the overview aggregate the
   page already holds, via pure modules in the subsystem
   (`collectDeadlineEntries` → `groupEntriesByDate` / `bucketAgendaEntries`
   → `derivePulseStats`). Downstream derivations consume upstream results —
   never re-derive from raw data — so surfaces cannot disagree (the pulse's
   late/next come from the agenda's buckets by construction).
3. **Panel persistence is a negative list.** The stored
   `{ open, collapsedSections }` state names only the _collapsed_ sections;
   an unknown or absent section key means expanded. Anchor ids inside the
   panel are namespaced per sidebar instance (`useId()` prefix).

## Why

- **Multi-project reuse.** A future projects-summary page must be able to
  render the same widgets per project without the overview's navigation.
  Injected-callback inertness is what keeps that door open; a widget that
  imports overview navigation closes it.
- **Filter mirroring.** The panel mirrors the overview's owner/group
  filters, which are applied client-side. A backend stats endpoint would
  either ignore those filters (the two surfaces disagree) or re-implement
  them server-side (duplicated filter semantics). Deriving from the
  already-filtered client list makes disagreement impossible. This was
  re-affirmed against a "move stats to the backend?" review question on
  PR #52.
- **No migrations for new sections.** The negative-list persistence let #50
  add `calendar`/`agenda` sections with zero storage migration; future
  widgets get the same for free.

## Trade-offs

- **Lost:** stats cannot be computed over data the client doesn't hold; if
  the overview ever paginates, the derivations need revisiting.
- **Lost:** each host page re-wires the cross-link callbacks. Acceptable:
  one page today, and the wiring is ~20 lines of state + handlers.
- **Gained:** widgets test as pure render functions (bare renders, no
  providers), derivations test as pure functions, and the reuse constraint
  is enforceable in review ("does this widget import anything but its
  props?").
