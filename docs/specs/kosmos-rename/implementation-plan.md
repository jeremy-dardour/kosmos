# Kosmos Rename — Implementation Plan

Product rationale and scope live in the [PRD](./PRD.md); this plan is the
phasing.

## Objective

Rename and reposition the application as **Kosmos**, drawing on the Greek sense
of an ordered arrangement. Kosmos is a visual project-management tool for
organizing workstreams, steps, ownership, and deadlines in one overview.

Wedding planning remains a valid project type and existing wedding-oriented
test fixtures and seed data remain unchanged. The rename removes wedding
branding from the product; it does not remove wedding use cases.

## Decisions

| Area                   | Decision                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| Product name           | `Kosmos`                                                                  |
| Technical slug         | `kosmos`                                                                  |
| Visual direction       | Orbit/constellation mark used in the app logo and favicon                 |
| Positioning            | General project management using the existing pipeline/workstream model   |
| Test and seed examples | Keep existing wedding examples                                            |
| Workspace packages     | Keep the architectural `@workspace/*` scope                               |
| Authentication storage | Rename directly to `kosmos.google-id-token`; forced sign-in is acceptable |
| Historical records     | Preserve session history and historically accurate wording                |
| Availability           | No zero-downtime or compatibility requirement; there are no users yet     |

## Phase 1 — Application identity

- Add a reusable Kosmos orbit/constellation SVG mark.
- Use the mark and text wordmark in the authenticated header and sign-in page.
- Add a matching SVG favicon.
- Set the document title and application metadata to Kosmos.
- Replace generic logo labels and product copy in English, French, and Spanish.
- Brand the OpenAPI description as Kosmos API.

## Phase 2 — Repository cleanup

- Rename the root package to `kosmos`.
- Rename local Docker images from `template-api` to `kosmos-api`.
- Rename template descriptions in application packages and READMEs.
- Rename the local development/test database placeholder from `nestjs` to
  `kosmos`; existing local databases may be recreated.
- Rename the browser authentication key from
  `wedding-planner.google-id-token` to `kosmos.google-id-token`.
- Rename mock Problem Details namespaces from `wedding-planner.dev` to
  `kosmos.dev`.
- Do not change wedding-oriented test fixtures or seed data.

## Phase 3 — Product documentation

- Reposition the current purpose, glossary, PRD, current-state, and active
  design documents around project management.
- Keep the existing capabilities and scope boundaries; this effort does not add
  new project-management features.
- Present weddings as one example where useful.
- Preserve historical session records.

## Phase 4 — Verification

- Audit the repository for old branding and template placeholders.
- Classify remaining `wedding` references as valid examples or history.
- Run type checking, linting, formatting, unit tests, and API E2E tests.
- Visually verify the favicon, sign-in page, authenticated header, responsive
  layout, and all supported languages.

## Phase 5 — External cutover

- Rename the GitHub repository to `jeremy-dardour/kosmos` and update local
  remotes and current documentation links.
- Change the Workload Identity Federation condition and IAM principal from the
  old repository slug to the new one.
- Create `kosmos-runtime`, grant its required secret access, and permit the
  deployer to act as it.
- Create the `kosmos` Cloud Run service using the existing image registry,
  Neon database, secrets, and runtime configuration.
- Set the GitHub production `RUN_SERVICE` variable to `kosmos`.
- Rename the Google OAuth consent-screen application and replace the authorized
  Cloud Run origin.
- Verify CI, deployment, authentication, application data, and backups.
- Delete the old Cloud Run service, runtime service account, OAuth origin, and
  obsolete IAM binding.

## Completion Criteria

- All user-visible product identity says Kosmos.
- No generic fullstack-template placeholders remain.
- Current documentation describes a general project-management product.
- Wedding examples remain valid but no longer define the product itself.
- Repository, deployment service, runtime identity, and OAuth application use
  the Kosmos name.
- The complete validation suite passes and production is verified after the
  external cutover.
