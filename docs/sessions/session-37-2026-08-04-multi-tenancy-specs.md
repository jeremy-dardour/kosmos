# Session 37 — Multi-tenancy specs: PRD, tech design, build tickets (2026-08-04)

## What was done

- Wrote and grilled the **multi-tenancy PRD**
  ([docs/specs/multi-tenancy/PRD.md](../specs/multi-tenancy/PRD.md)) — all 10
  open questions resolved in one grilling pass.
- Mapped every single-project assumption in the code (Explore agent): routes
  already half project-scoped; leaks are the flat `/{resource}/{id}` handlers,
  `em.find(User, {})` in the overview repository, unscoped `GET /projects`,
  and the web's `projects.data?.[0]?.id`.
- Wrote and grilled the **tech design**
  ([docs/specs/multi-tenancy/tech-design.md](../specs/multi-tenancy/tech-design.md)),
  including an in-depth D1 discussion (guard-level vs data-layer enforcement
  in NestJS; RLS / MikroORM filters / module guards / service asserts all
  weighed).
- Decomposed into 4 confirmed vertical slices and filed them as GitHub issues
  [#53](https://github.com/jeremy-dardour/wedding-planner/issues/53)–[#56](https://github.com/jeremy-dardour/wedding-planner/issues/56);
  build sequence + dependency graph added to the tech design.

## Decisions

All recorded in the two specs (single home): PRD Decisions 1–14 and tech
design D1–D5. Headlines:

- Trusted-circle audience; entry stays the `.env` allow-list — no signup
  page, no invites, no admin console, no email sending (PRD 1–3, 9).
- Owner + equal members; add-member-by-email with pending attach-on-login;
  transferable ownership; 20/20 sanity caps (PRD 6–8, 10).
- Versioning dropped (PRD 13). Soft delete: restore-only trash, no purge
  (PRD 14 / D5 — added during slicing).
- Membership enforced by an actor-scoped **repository predicate** only;
  non-member → 404; guards stay authn-only (D1).
- `Project.ownerId` FK + owner-always-has-a-member-row (D2); schema-only
  migration, no legacy data — app is pre-deployment (D3); `/` +
  `/projects/:projectId` routes (D4).

## Learnings / tensions surfaced

- The PRD's original invite-only/operator/admin-console exploration was
  superseded mid-grilling by "keep the allow-list" — recorded in the PRD so
  it isn't re-litigated.
- Original migration goal ("transition without loss") was moot: the app has
  never been deployed. Seeder covers dev via `SEED_OWNER_EMAIL` (untracked
  env) to keep real emails out of the repo (visibility rule).
- PR #52 (widget panel) is frontend-only and passes `projectId` as a prop —
  no plan impact, but it must merge **before** T-1 (#53), which rewires
  `router.tsx`/`overview-page.tsx`.

## Status at end of session

Multi-tenancy fully specced and ticketed (#53→#54→#55→#56, strictly
sequential, T-2 is the security boundary). Not started: implementation.
Deployment (#26) and PR #52 remain queued ahead. `docs/project-purpose.md`
still describes the single-couple audience — update it when tenancy ships.
