# Handoff: Wedding Preparation Tracker — Pipeline Overview

## Overview

A **timeline + pipeline hybrid** for tracking 20–50 wedding workstreams at a glance. The final wireframe (turn 3, option 3a) defines the chosen layout: a **Pipeline Stack** (grouped card list on the left, slide-over detail panel on the right) with a **hybrid deadline treatment** (countdown badge in each card header + date-tick labels under pipeline dots that have deadlines).

## About the Design Files

The bundled `.dc.html` file is a **design reference prototype built in HTML** — it shows intended layout and behavior, not production code. The task is to **recreate this design** in your target codebase's existing environment (React, Vue, Next.js, etc.) using its established patterns, or to choose the most appropriate framework if none exists yet.

The wireframe file contains three turns of exploration. **Turn 3 (option 3a) is the final direction.** Turns 1 and 2 are earlier explorations kept for context.

## Fidelity

**Low-fidelity (wireframe).** These are structural/behavioral wireframes — not pixel-perfect mockups. Use them as a guide for layout, component hierarchy, and interaction patterns. Apply your own design system or choose appropriate styling. The wireframes use placeholder colors for status coding (green/blue/red/grey) — keep these semantics but adjust exact values to your palette.

---

## Architecture: Core Entities

### Workstream

A named track of preparation work (e.g. "Venue", "Catering"). Contains an ordered pipeline of Steps. Has:

- `name`, `icon`, `group` (category), `owner` (user)
- Ordered list of `Step` objects
- `currentStepIndex` (pointer to active step)
- `dependencies` (list of other Workstream IDs — visual only, no enforcement)

### Step

An individual action within a Workstream pipeline. Has:

- `name`, `status` (see below), `owner` (inherits from Workstream if unset)
- Optional `deadline` (date)
- Optional `completionDate` (auto-set when Done/Skipped)
- `notes` (append-only timestamped entries)
- `links` (URL + label pairs)
- Optional `isChecklist` flag → contains `subItems[]` (name + done boolean)

### Step Statuses

| Status      | Visual                                  | Meaning                                   |
| ----------- | --------------------------------------- | ----------------------------------------- |
| Not Started | Grey outlined circle                    | Ahead of current position                 |
| In Progress | Large blue filled circle with glow ring | The current step — most prominent element |
| Done        | Green filled circle                     | Completed                                 |
| Skipped     | Dashed outlined circle                  | Intentionally bypassed                    |
| Blocked     | Red filled circle with glow ring        | Stuck — informational flag                |

### Group

A category label on Workstreams for visual clustering. Has `name` and `color`. No behavior or roll-up status.

### User

Identified by Google email. All users have equal access (no roles). 2–6 users per instance.

---

## Screen: Main Overview (the only screen)

### Layout: Two-Panel Split

```
┌─────────────────────────────────┬──────────────────────────┐
│ LEFT PANEL (≈58%)               │ RIGHT PANEL (≈42%)       │
│                                 │                          │
│ Header bar                      │ Detail slide-over        │
│ ─────────────────────           │ (selected workstream)    │
│ Grouped workstream cards        │                          │
│ scrollable                      │ Vertical step pipeline   │
│                                 │ Checklist (if applicable)│
│                                 │ Notes log                │
│                                 │ Links                    │
│                                 │ Dependencies             │
└─────────────────────────────────┴──────────────────────────┘
```

### Left Panel — Header Bar

- **Title**: "Wedding Prep"
- **Countdown badge**: "147 days" (days until wedding date) — light grey pill
- **Filter: "My Tasks ▾"** — dropdown filtering by current user's assigned steps
- **Filter: "All Groups ▾"** — dropdown filtering by workstream group/category

### Left Panel — Workstream Card List

Cards are grouped by category with section headers.

**Group header**: uppercase label + small colored square (group color).

**Each workstream card contains:**

1. **Top row** (flex, space-between):
   - Left: icon + workstream name (600 weight) + owner avatar (initials in colored circle)
   - Right: **countdown badge** (pill shape) + **Advance → button**

2. **Countdown badge logic**:
   - Shows the _nearest upcoming deadline_ for that workstream: `"{stepName} in {N}d"`
   - Urgency threshold at 7 days: `< 7d` → red background (`#fce8e6` bg, `#d45a4a` text), warning icon
   - `≥ 7d` → grey background (`#f3f2ef` bg, `#888` text)
   - **Overdue**: solid red background (`#d45a4a` bg, white text), `"{stepName} {N}d overdue"`
   - If no upcoming deadlines: hide badge

3. **Pipeline row**: horizontal sequence of step circles with step name labels below each dot
   - Circles connected by thin lines (1.5px)
   - Done = green filled (10px), In Progress = blue filled with glow (14px), Not Started = grey outline (10px), Skipped = dashed outline, Blocked = red filled with glow
   - **Date ticks**: steps WITH deadlines show the date below the step name in small text. Urgent deadlines in red, comfortable ones in grey. Steps without deadlines show no date — keeps it sparse.

4. **Card states**:
   - **Default**: 1px grey border
   - **Selected** (detail panel open): 1.5px blue border, light blue background
   - **Blocked**: 1.5px red border, light red background, "BLOCKED" badge next to name, "Resolve ▾" dropdown instead of "Advance →"
   - **Overdue**: 1.5px red border, light red background (same as blocked but with overdue countdown)

### Right Panel — Detail Slide-Over

Opens when a card is clicked. Shows full detail for one workstream.

**Header**: icon + workstream name + close button (✕)

**Vertical step pipeline** (top section):

- Each step as a vertical list item with a connecting line between circles
- Done steps: strike-through text + completion date
- Current step: larger blue dot, bold blue text, "CURRENT" badge
- Steps with deadlines: show date + relative countdown (`"Jun 15 · in 5d ⚠"`)
- If current step is a **checklist step**: inline card showing sub-items with checkboxes and completion count ("CHECKLIST — 2/4")

**Notes section** (middle):

- Header: "NOTES" + "+ Add note" action
- Reverse-chronological list of timestamped entries: `"Jul 10 · AL"` + note text
- Append-only

**Links section** (bottom left):

- Header: "LINKS"
- List of clickable URL + label pairs

**Dependencies section** (bottom right):

- Header: "DEPENDS ON"
- List of workstream names this one depends on (visual info only)

---

## Key Interactions

### 1. Advance a Workstream (most frequent)

- **From card**: click "Advance →" button directly on the card
- Moves `currentStepIndex` forward by one
- If current step is **Blocked**: button changes to "Resolve ▾" dropdown with options "Mark Done" / "Mark Skipped", then advances
- If current step is a **Checklist Step**: all sub-items must be checked before advancing (disable button until complete)
- Auto-records `completionDate` on the step being completed

### 2. Zoom Into Workstream

- Click anywhere on the card (except Advance button) → opens detail slide-over panel on right
- Card gets blue selected border
- Clicking ✕ or another card dismisses/swaps

### 3. Add a Note

- In detail panel → click "+ Add note" → inline text input
- Saves with timestamp + current user

### 4. Add a Link

- In detail panel → similar add action
- URL + label input

### 5. Filter by Owner

- "My Tasks ▾" dropdown in header
- Filters card list to workstreams where the current step's owner matches selected user
- "All" option to show everything

### 6. Filter by Group

- "All Groups ▾" dropdown
- Shows/hides groups

---

## State Management

```
State:
  workstreams: Workstream[]        // all workstreams with nested steps
  selectedWorkstreamId: string     // which detail panel is open (null = closed)
  filterOwner: string | null       // user email or null for "all"
  filterGroup: string | null       // group name or null for "all"
  currentUser: User                // logged-in user

Derived:
  groupedWorkstreams               // workstreams grouped by category
  filteredWorkstreams              // after owner/group filters applied
  nearestDeadline(ws)              // for countdown badge per workstream
```

## Design Tokens (wireframe reference values — adapt to your system)

### Status Colors

| Token          | Hex                    | Usage                                           |
| -------------- | ---------------------- | ----------------------------------------------- |
| done           | `#6aae7e`              | Completed step circles                          |
| inProgress     | `#4a7fd4`              | Current step, selected card border, CTA buttons |
| inProgressGlow | `rgba(74,127,212,0.2)` | Glow ring on current step                       |
| notStarted     | `#ccc`                 | Future step circle borders                      |
| blocked        | `#d45a4a`              | Blocked/overdue steps, urgent deadlines         |
| blockedGlow    | `rgba(212,90,74,0.2)`  | Glow ring on blocked step                       |
| skipped        | `#aaa` dashed          | Skipped step circle borders                     |

### Group Colors (sample)

| Group        | Color     |
| ------------ | --------- |
| Logistics    | `#8b6cc1` |
| Food & Drink | `#e09850` |
| Vendors      | `#5a9e6f` |

### Urgency Thresholds

- **Comfortable** (≥ 7 days): grey badge (`#f3f2ef` bg, `#888` text)
- **Urgent** (< 7 days): red badge (`#fce8e6` bg, `#d45a4a` text)
- **Overdue**: solid red badge (`#d45a4a` bg, `#fff` text), card gets red border treatment

### Typography (wireframe used system-ui — choose your own)

- App title: 600 15px
- Card workstream name: 600 12px
- Step labels under dots: 400 7px
- Countdown badge: 600 9px
- Detail panel step name: 400–600 11–12px
- Notes text: 400 10px
- Section headers (NOTES, LINKS): 500 10px uppercase tracking

### Spacing

- Card padding: 14–16px
- Card gap (vertical): 10px
- Group header margin-bottom: 8px
- Panel padding: 16–20px
- Pipeline dot size: 10px (done/not started), 14px (current/blocked)
- Pipeline connector: 16px wide, 1.5px thick

---

## Component Hierarchy (suggested)

```
<App>
  <Header>
    <Title />
    <CountdownToWedding />
    <OwnerFilter />
    <GroupFilter />
  </Header>
  <MainLayout>
    <CardList>
      <GroupSection label group>
        <WorkstreamCard
          workstream
          isSelected
          onSelect
          onAdvance
        >
          <CountdownBadge nearestDeadline />
          <PipelineDots steps currentIndex />
        </WorkstreamCard>
      </GroupSection>
    </CardList>
    <DetailPanel workstream onClose>
      <VerticalPipeline steps currentIndex />
      <ChecklistCard subItems />     {/* if current step is checklist */}
      <NotesLog notes onAddNote />
      <LinksList links onAddLink />
      <DependenciesList deps />
    </DetailPanel>
  </MainLayout>
</App>
```

---

## Files

| File                                 | Description                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `Wedding Tracker Wireframes.dc.html` | Full wireframe prototype. **Turn 3, option 3a** is the final direction. Open in browser to view. |

---

## Open Implementation Notes

- **Persistence**: The wireframe doesn't specify a backend. You'll need a data store for workstreams, steps, notes, links. Firestore or Supabase would work well for the 2–6 user scale with real-time sync.
- **Auth**: Google OAuth, email whitelist for access control.
- **Dependencies**: Shown as text list in detail panel. No visual arrows in this layout (that was explored in wireframe 1a but not carried forward). Could add subtle connector lines later.
- **Responsive**: Desktop-first. On tablet, the detail panel could slide over the card list as a modal rather than side-by-side.
- **Empty states**: Not wireframed — add appropriate empty states for no workstreams, no notes, no links, etc.
- **Reordering / editing workstreams**: Not in scope for V1 overview — assume workstreams are configured elsewhere or in a settings view.
