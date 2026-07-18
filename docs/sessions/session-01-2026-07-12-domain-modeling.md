# Session 01 — Domain Modeling (2026-07-12)

## What was done

Ran a `/grilling` + `/domain-modeling` pass to establish the domain for the
wedding-prep tracker. Settled the core entity model, step lifecycle, ownership,
grouping, dependencies, the overview visualization concept, and access control.

## Decisions

Decisions 1–19 in [docs/domain-decisions.md](../domain-decisions.md).

## Learnings / tensions surfaced

- **Pipeline vs. checklist:** resolved by keeping the pipeline as the backbone
  and adding Checklist Steps (unordered sub-items that must all complete before
  advancing) as the escape hatch for unordered work.
- **Timeline + pipeline hybrid overview:** framed the overview as each workstream
  rendered as its step sequence with deadline-steps anchored to a time axis.
  _(This shared-axis idea was later dropped in the prototype — see Decision 24.)_
- **Google Groups for access control:** explored but rejected — consumer Gmail
  Groups API access is awkward. Went with an in-app email whitelist.
- **Blocked status:** the "soft flag vs. hard gate" options collapse to the same
  behavior, so Blocked is purely informational and advancing forces a
  Done/Skipped choice.

## Status at end of session

Domain ~80% resolved; core entities and the pipeline interaction model locked.
Open: overview layout, mutations from overview, detail-view form, dependency
display, deadline urgency, whitelist management, notifications, multi-project
scope.
