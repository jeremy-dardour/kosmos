# Prototype — widget rail + panel (deadline calendar + project stats)

**Status: verdict reached (2026-07-31), ready to ticket.** Post-V1 work: not
part of #40 or deployment (#26).

## The question

What form should the deadline calendar take in a ~360px right panel —
**agenda list by month**, **month grid with day details**, or a **hybrid**
(mini grid over the agenda)? Everything else about the widget system is
already decided (below); only the calendar's shape is being compared.

## How to run

Ports per [PORTS.md](../../../PORTS.md). On top of the `?variant=A` inline
overview prototype:

```
http://localhost:<WEB_PORT>/?variant=A&panel=agenda   (or grid, hybrid)
```

The bottom-center bar cycles the three calendar forms. The right-edge icon
rail toggles the stats and calendar widgets on/off.

## Decisions already settled (grilling, 2026-07-31)

- **Entry mechanism**: slim icon rail on the right edge, one icon per widget,
  click toggles; the open panel is a fixed-width right split panel. No
  drag-to-expand (resize is later polish, not the mechanism).
- **Widget model**: enabled widgets stack vertically in one panel — stats
  (compact) on top, calendar below — so both are visible at once. Scales to
  future widgets.
- **Filters**: the whole panel mirrors the overview's owner/group filters,
  with a visible "Mirroring filters: …" indicator. The two surfaces never
  disagree; the owner filter turns the panel into a personal dashboard.
- **Calendar content**: pending deadlines only — current + not-started steps
  of live workstreams, overdue included (exactly the set that gets urgency
  rings). Settled steps and Complete workstreams stay out. No dedicated
  wedding-day row (the header countdown owns that fact).
- **Entry identity**: day number (urgency-coloured, five-band scale) + step
  name + workstream icon and name + countdown; blocked steps get a warning
  marker.
- **Cross-linking**: click an entry → the overview scrolls to the card and
  opens that step's inline editor; hover highlights the card. Stats are
  read-only except the next-deadline row, which cross-links the same way.
- **Stats metrics**: lifecycle counts (total / active / queued / done),
  attention counts (blocked, overdue — coloured only when nonzero), next
  deadline, and overall progress % (settled steps / all steps).
- **Reusability constraint**: the widgets are presentational — they take
  derived data plus injected `onEntryClick` / `onEntryHover` callbacks and
  never import overview navigation. A future multi-project overview page must
  be able to render them per project without the cross-link behaviour. The
  prototype honours this: the host page converts the injected callback into a
  DOM event the card list listens for.
- **No backend changes**: the overview aggregate already carries every step's
  deadline, status and owner; both widgets derive client-side.
- **Ticketing (after the verdict)**: two tickets — **A: rail + panel shell +
  stats widget**, **B: calendar widget** (depends on A).

## What the prototype demonstrated

- All three calendar forms render against real seed data; cross-link click
  opens the right step editor (including a blocked, overdue one) and the
  hover highlight works.
- Filter mirroring works end-to-end: indicator, recomputed stats, reduced
  calendar.
- Sparseness is real: a month grid can show a single marked day for a whole
  month, which is the agenda's core argument.

## Verdict

- **Calendar form: both, stacked.** Not a choice between agenda and grid —
  the panel stacks three sections top to bottom: **Project pulse** (stats),
  **Calendar** (month grid), **Agenda** (list by month). Each section
  collapses individually behind its header (chevron + title + summary count);
  all are expanded by default. Clicking a marked day in the grid expands the
  agenda if needed and scrolls it to that month.
- **Rail**: with sections collapsible in place, the per-widget rail icons
  became redundant — the rail keeps a single toggle that shows/hides the
  whole panel.
- The `?panel=` variant switcher is removed; the prototype now renders the
  chosen layout directly under `?variant=A`.

### Side verdict — the card's advance button (refines #40 §3.8)

Placement stays after-title ("on the left"), but the button is **no longer
the solid black primary**: the split Advance/chevron pair uses the secondary
(muted, bordered) treatment, and gets extra left margin so it reads as the
card's action rather than another badge in the name/group/status cluster.
Carry this into the #40 rework when `workstream-card-action.tsx` is restyled.

## Files (all throwaway)

| File                                                              | Role                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/web/src/features/overview/widget-panel-prototype.tsx`       | Rail, panel, stats widget, three calendar forms, switcher.  |
| `apps/web/src/features/overview/widget-panel-prototype-shared.ts` | Deadline collection + cross-link event seam.                |
| `apps/web/src/features/overview/overview-page.tsx`                | Modified: mounts the sidebar, injects cross-link callbacks. |
| `apps/web/src/features/overview/overview-editing-prototype.tsx`   | Modified: card DOM ids + open-step event listener.          |

Delete all of it (and this folder) once the verdict is recorded in the
tickets.
