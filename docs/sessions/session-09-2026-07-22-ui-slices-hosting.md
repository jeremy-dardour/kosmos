# Session 09 — UI Build Slices & Hosting Decision (2026-07-22)

## What was done

- **Closed ticket 02** (auth internals research) — was already resolved, just
  needed formal status update in the tracker.
- **Resolved ticket 07 — Overview UI build slices.** Sliced the web build into
  7 ordered increments:
  1. Layout shell + overview data fetch
  2. Grouped workstream card list with pipeline dots
  3. Detail slide-over (read-only)
  4. Pipeline actions (advance / start / blocked resolve)
  5. Deadline badges + owner/group filters
  6. Notes write actions (add/edit/delete)
  7. Checklist toggles + step attribute edits
- Decided **English-first i18n** (`en` primary, `fr` secondary) and confirmed
  same `openapi-react-query` data-fetching pattern as the `items` reference.
- **Reviewed hosting research** (ticket 03) and summarized options for decision.
- **Resolved ticket 03** (hosting research) — formally closed.
- **Resolved ticket 06 — Deployment & hosting approach.** Decision: \*\*Cloud Run
  - Neon + single deployable.\*\* ~$0/mo steady state on indefinite free tiers.
    Single container serves both API and SPA (no CORS, no second pipeline).
- **Started reading ticket 09** (state machine implementation) — loaded ADR
  0005, entity schema, and reference service pattern before session ended.
- Updated `current-state.md` with all resolved tickets and revised next steps.

## Decisions

- **UI slicing:** 7 increments (see ticket 07 for details). Originally proposed
  as 5; split slice 1 (too large) and slice 5 (crosses too many endpoints) per
  owner feedback.
- **i18n:** English-first. Template fallback stays as-is; `en.json` is the
  source of truth for copy.
- **Hosting:** Cloud Run + Neon + single deployable. AWS was considered (existing
  account) but costs more (~$20–30/mo after 12-month free tier vs ~$0/mo
  indefinitely). Neon is cross-cloud (not GCP-native) but is just a connection
  string — no management overhead.

## Learnings

- The owner's instinct was toward AWS (familiarity + existing account), but the
  cost difference at this scale is stark. Judging each option against the
  project's actual scale helped land the decision quickly.
- Splitting large slices early (before they become implementation tickets)
  saves rework — the owner caught slice 1 being too big before it was written up.

## Status at session end

7 of 9 wayfinder tickets resolved. Two remain:

- **Ticket 09** — State machine implementation (unblocked, started reading).
- **Ticket 08** — Sequence V1 into ordered increment-specs (unblocked now that
  06 + 07 are resolved; last planning ticket before building).
