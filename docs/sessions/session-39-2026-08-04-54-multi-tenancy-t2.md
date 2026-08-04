# Session 39 — T-2: tenancy enforcement and review close-out (2026-08-04)

## What was done

- Picked up after T-1 had merged as
  [PR #59](https://github.com/jeremy-dardour/wedding-planner/pull/59) and built
  [#54](https://github.com/jeremy-dardour/wedding-planner/issues/54) across
  eight build commits plus one review-fix commit, following the
  [plan posted on PR #59](https://github.com/jeremy-dardour/wedding-planner/pull/59#issuecomment-5179211068).
- Added per-controller actor resolution and explicit actor threading through
  all project-content handlers; repository predicates now make non-members
  and soft-deleted projects indistinguishable from missing resources.
- Scoped project, overview, workstream, group, step, checklist-item, and note
  access; limited the overview directory to joined members; required assigned
  owners to be joined project members; added the web project-not-found state.
- Adapted shared fixtures to create membership rows and expanded API e2e
  coverage with a 54-case tenancy matrix spanning member success, non-member
  404, soft-deleted-project 404, member directory, and owner assignment.
- Added the lowercase project-member-email migration and verified API contract
  regeneration produced no diff.
- Ran the full review battery: standards, spec, security, and simplification.
  Triaged every finding and fixed the one Medium security issue: workstream
  reorder looked up a submitted group before the actor-scoped project root,
  allowing a revoked member with retained UUIDs to probe group membership.
- Applied the remaining review cleanup: one shared member-owner resolver, one
  overview 404 constant, a fail-fast membership-predicate guard, corrected
  fixture JSDoc placement, and the T-4 matrix-extension note.
- Validated types, lint, formatting, 100 API unit tests, 412 web tests, and
  208 API e2e tests; pushed the branch and prepared draft
  [PR #61](https://github.com/jeremy-dardour/wedding-planner/pull/61).

## Decisions

- Actor resolution uses a per-controller interceptor plus `@Actor()`, while
  services continue to require the actor argument as a compile-time backstop;
  recorded in the
  [multi-tenancy tech design](../specs/multi-tenancy/tech-design.md).
- Build-shape decisions and deliberately retained review items live in the
  [PR #59 build-plan comment](https://github.com/jeremy-dardour/wedding-planner/pull/59#issuecomment-5179211068)
  and [PR #61](https://github.com/jeremy-dardour/wedding-planner/pull/61).

## Learnings / tensions surfaced

- Authorization ordering matters as much as eventual rejection: a related-row
  lookup before the actor-scoped aggregate root can leak existence through
  otherwise-correct 404 behavior.
- E2e owner-assignment fixtures must create joined membership explicitly;
  authentication and user existence alone are intentionally insufficient.
- Three one-off local transport/test failures did not reproduce (a required
  null-field case, one `ECONNRESET`, and one malformed HTTP response); a
  matching CI failure should be treated as a recurrence and investigated.

## Status at end of session

T-2 is complete, reviewed, fully green, and open as draft PR #61 against
`main`. Next: review and merge #61, then build T-3 (#55) followed by T-4 (#56).
