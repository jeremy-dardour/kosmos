# Kosmos Rename — PRD

## Context

The application began as a wedding-preparation tracker and its identity said
so everywhere: product name, branding, repository, deployment resources, and
documentation. The product itself was always more general — a pipeline
tracker for any project with many parallel workstreams — and multi-tenancy
work is opening it to more projects than the original wedding.

This effort renames and repositions the product as **Kosmos** (from the Greek
sense of an ordered arrangement): a visual project-management tool for
organizing workstreams, steps, ownership, and deadlines in one overview.
It is an identity change only — no new product features.

The [implementation plan](./implementation-plan.md) is the HOW/phasing
companion to this document.

## Goals

1. Every user-visible surface — app UI, sign-in page, browser tab, API
   documentation — presents the product as Kosmos.
2. Documentation describes a general project-management product, with
   weddings as one example project rather than the product's definition.
3. No generic fullstack-template placeholders remain anywhere a user or
   contributor would encounter them.
4. External surfaces (repository, deployment service, runtime identity,
   OAuth consent screen) carry the Kosmos name after a post-merge cutover.

## Capability Surface

### Product identity in the app

Users see a Kosmos orbit/constellation mark and wordmark on the sign-in page
and in the authenticated header, a matching favicon, and "Kosmos" as the
document title — in all three supported languages (English, French, Spanish).

- As a signed-out visitor, I want the sign-in page to present the product
  name and mark, so that I know what I'm signing in to.
- As a user of assistive technology, I want the product name announced on
  the sign-in page and header, so that identity isn't visual-only.
- As a signed-in user, I want the header mark to link home, so that the logo
  behaves the way logos conventionally do.

### Repositioned documentation

Current-facing docs (purpose, glossary, live state, active specs) describe a
project-management tool. Historical records — session logs, the V1 PRD, and
historically accurate wording — are preserved as written.

- As a contributor, I want current docs to describe the product as it is
  positioned today, so that I don't build for a wedding-only product.
- As a reader of project history, I want past records untouched, so that the
  record stays accurate about what was true at the time.

### Continuity for existing use

Wedding planning remains a fully valid project type; existing wedding-themed
test fixtures and seed data stay. Signed-in users are signed out once by the
rename (no users exist yet, so this is acceptable).

- As the existing user, I want my wedding project to keep working unchanged,
  so that the rename costs me nothing but a re-login.

## Decisions Made

| #   | Decision                                                             | Context                                                       |
| --- | -------------------------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Product name **Kosmos**, technical slug `kosmos`                     | Greek "ordered arrangement"; fits the overview-of-order pitch |
| 2   | Orbit/constellation visual mark                                      | Evokes many workstreams arranged around one center            |
| 3   | Reposition as general project management; no new features            | Identity change only — capability set is untouched            |
| 4   | Wedding examples remain in fixtures, seeds, and docs where useful    | Weddings stay a first-class example use case                  |
| 5   | Historical records keep their original wording                       | Session logs and the V1 PRD are point-in-time records         |
| 6   | Forced one-time sign-out is acceptable                               | No users yet; no compatibility or zero-downtime requirement   |
| 7   | External cutover (repository, deployment, OAuth) happens after merge | Keeps the identity change reviewable before touching infra    |

## Out of Scope

- Any new project-management capability (templates, roles, notifications…).
- Changing the domain model or its wedding-compatible semantics.
- A custom domain or marketing/landing site for Kosmos.
- Renaming the internal `@workspace/*` package scope.

## Open Questions

| #   | Question                                                                                           | Depends on                |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Should the brand mark adapt to light/dark theme, or stay fixed-color as a deliberate brand choice? | Visual review after merge |
