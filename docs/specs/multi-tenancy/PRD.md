# Multi-Tenancy — PRD

Status: agreed (grilled 2026-08-03) — tech design pending

## Context

V1 is deliberately single-tenant: exactly one Project, 2–6 trusted users with
equal access, gated entirely outside the app by a static
`.env` email allow-list. There is no Project↔User membership — Users are
effectively global — and no roles beyond "note authors may edit/delete only
their own entries".

The seams for this feature were planned from the start: the Project entity is
generic (multi-project is listed in the V1 PRD as "the seam is there but not
surfaced"), and Users are already created
automatically on first Google login.

This feature surfaces that seam for a **trusted circle**. Allow-listed users
create their own projects and work in projects shared with them. It is not an
open product — entry stays
personally gated, and the polish/abuse bar is "works well for people who can
reach the operator directly".

## Goals

1. A new allow-listed person can start using the tool with nothing more than
   signing in with Google — no per-user setup by the operator beyond the
   allow-list entry.
2. A signed-in user can create and run their own projects, and sees exactly
   the projects they belong to — never anyone else's.
3. A project owner controls who has access to their project, per project;
   helpers join by being added, not by global membership.
4. ~~The existing wedding project transitions without loss~~ — superseded:
   the app is not yet deployed, so there is no legacy data to preserve; local
   databases are recreated from the seeder (tech design D3).

## Capability Surface

### Account entry ("signup")

There is no signup page and no invite system. Access to the app is granted by
adding an email to the `.env` allow-list, exactly as today; the account is
created automatically on that person's first Google sign-in. Google is the
only identity provider.

- As an allow-listed newcomer, I want my account to exist the moment I first
  sign in with Google, so that getting started requires no registration step.
- As a newcomer with no projects yet, I want a clear empty state that leads me
  to create my first project, so that I'm not stranded on a blank screen.
- As a non-allow-listed visitor, I am rejected at sign-in (as today) — no
  self-service path in.

### Per-user projects

Every project has exactly one **owner** — initially its creator. Any user can
create projects and belong to any number of projects (their own and others').

- As a user, I want to create a new project (name, optional event date), so
  that I can start planning an event; I become its owner.
- As a user with several projects, I want a project list showing the projects
  I own and those shared with me, so that each event stays separate.
- As a user, I want to open a specific project directly by URL, so that
  bookmarks and shared links work — subject to my being a member.
- As an owner, I want to delete my project after a clear confirmation, so
  that abandoned plans don't linger. Deleting is **soft**: members lose
  access immediately (the project vanishes from their lists and links), while
  I still see it in a collapsed "Deleted" section of my project list.
- As an owner, I want to restore a deleted project, so that a
  change of heart costs nothing — members get access back exactly as before.
  Deleted projects are not openable (card + Restore only), don't count
  toward my project cap, and are never permanently purged in this version.
- As a user, I must never see or reach a project I'm not a member of — not in
  the project list, owner pickers, or by URL.

Sanity caps apply (not monetization, just accident-bounding): at most 20
projects per user and 20 members per project. Hitting a cap shows a plain
"limit reached" message.

### Sharing and membership

The unit of sharing is the whole project. The owner manages membership; the
app never sends email — coordination ("you're in, go sign in") happens
person-to-person.

- As an owner, I want to add a member by typing their email, so that a helper
  gets access to this project — and only this project.
- As an owner adding an email that has no account yet, I want the membership
  to wait and attach automatically when that person first signs in, so that I
  don't have to time my add around their first login. (Membership grants
  access to the project; only the allow-list grants access to the app — both
  are needed.)
- As an owner, I want to remove a member (or revoke a pending, never-signed-in
  membership), so that access ends when involvement ends.
- As a member, I want to leave a project myself, so that I'm not stuck in
  projects I no longer care about.
- As an owner, I want to transfer ownership to another member, so that the
  other half of the couple can take over. An owner cannot leave their own
  project — transfer first, or delete the project.

### Project-bound permissions

Two levels only, preserving V1's "tool informs, never obstructs" ethos among
trusted people:

- **Members** can do everything content-wise — workstreams, steps, checklists,
  notes, groups, and project settings (name, event date): exactly today's
  behavior. The note-authorship rule carries over (edit/delete own notes
  only).
- **The owner** alone governs the project's existence and access: add/remove
  members, transfer ownership, delete the project.

- As an owner, I want membership controls visible only to me, so that members
  can't change who has access.
- As a member, I want owner-assignment pickers to offer only this project's
  members (users who have actually joined — not pending emails), so that
  people from my other projects never leak into this one.

### Landing experience

- After sign-in, every user lands on the **project list** (owned + shared).
- A project URL opened directly goes straight to that project's overview,
  membership permitting.
- Zero projects → empty state with "create your first project".

## Decisions Made

| #   | Decision                                                                                   | Context                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Audience is a trusted circle (friends/family), not an open product                         | Sets the polish/abuse bar; entry stays personally gated                                                                            |
| 2   | Entry stays gated by the `.env` email allow-list; no signup page, no invites, no admin UI  | "Signup" is just first Google login by an allow-listed email — which already works today                                           |
| 3   | Google-only identity                                                                       | No new auth surface; consistent with the existing GIS setup                                                                        |
| 4   | Project is the tenancy unit; no org/team layer                                             | The generic Project seam was built for exactly this                                                                                |
| 5   | User accounts are global; membership is per project                                        | Matches the existing model (User created on first login, identified by email)                                                      |
| 6   | Two permission levels: owner + members                                                     | Members = full content access incl. settings; owner adds governance only                                                           |
| 7   | Add member by email with pending memberships that attach on first sign-in                  | One flow covers existing and future users; no coordination on timing                                                               |
| 8   | Ownership is transferable to a member; owner cannot leave without transferring or deleting | Covers the realistic "partner takes over" case cheaply                                                                             |
| 9   | The app sends no email whatsoever                                                          | Pull-only notification stance survives; invitations are coordinated person-to-person                                               |
| 10  | Sanity caps: 20 projects/user, 20 members/project                                          | Bounds accidents, not monetization; adjust numbers freely at implementation                                                        |
| 11  | Landing = project list; direct project URLs supported                                      | Predictable entry point; deep links for daily use                                                                                  |
| 12  | No data migration — fresh start                                                            | Superseded original "operator owns the existing project" plan: the app is pre-deployment, so no legacy data exists; dev DBs reseed |
| 13  | Versioning is dropped from this feature                                                    | Was a "maybe"; no agreed problem it solves — revisit with real usage (templates most likely)                                       |
| 14  | Project deletion is soft: restore-only trash, no purge                                     | Members lose access instantly; owner keeps a restorable card; deleted projects don't count toward the cap (2026-08-04)             |

## Out of Scope

- Permanent deletion (purge) of soft-deleted projects.
- Project versioning in any form (history, snapshots, templates/duplication).
- Signup pages, invite flows, or any in-app user management/admin console.
- Identity providers beyond Google; passwords.
- Roles beyond owner/member (no viewer tier, no per-workstream permissions).
- Billing, plans, quotas as monetization.
- Organizations/teams above the project level.
- Cross-project features (dashboards spanning projects, moving workstreams
  between projects).
- Any email sending or push notifications; pull-only stands.
- Account deletion/deactivation flows (removal from the allow-list blocks
  sign-in; data handling beyond that is deferred).
- Real-time collaboration/presence; last-write-wins concurrency carries over.

## Open Questions

None — all resolved in the 2026-08-03 grilling. Superseded explorations for
the record: invite-only entry, operator-issued app invites, and a light admin
console were all considered and replaced by "allow-list stays in `.env`";
owner/editor/viewer tiers were rejected in favor of owner + equal members.
