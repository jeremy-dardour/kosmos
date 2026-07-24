# Session 11 — Google OAuth Auth Implementation (2026-07-23)

## What was done

- Implemented GitHub issue
  [#25 — Auth: Google OAuth wiring](https://github.com/jeremy-dardour/wedding-planner/issues/25).
- Updated the API auth pipeline for Google ID tokens:
  - bare Google OAuth client ID audience, no `api://` prefix
  - Google claim shape (`email`, `email_verified`, `picture`, `hd`)
  - no `AUTH_ACCEPTED_SCOPES` / `scp` validation
  - static `AUTH_ALLOWED_EMAILS` allow-list with 403 rejection for valid but
    unauthorized tokens
- Added auth-time User provisioning:
  - initially added a `User` entity and migration on the auth branch
  - upsert by normalized email on authenticated requests
  - refresh name and avatar from Google claims
  - attach persisted user id to `request.user`
- Implemented web Google authentication:
  - `GoogleAuthProvider` using the GIS JS SDK
  - `VITE_GOOGLE_CLIENT_ID`
  - env-driven `FakeAuthProvider` vs `GoogleAuthProvider` selection
  - initially used auth events so protected routes re-render after async
    login/logout
- Updated API e2e token factories and tests to Google ID-token claims.
- Updated README, env examples, and CI env config for the new auth variables.

## Validation

- `pnpm --filter api check-types`
- `pnpm --filter web check-types`
- `pnpm --filter api lint`
- `pnpm --filter web lint`
- `pnpm --filter api test`
- `pnpm --filter web test -- src/auth/__tests__/google-auth-provider.spec.ts`
- `pnpm --filter api db-e2e:migrate:fresh && pnpm --filter api test:e2e`
- `pnpm --filter api build`
- `pnpm --filter web build`
- `git diff --check`

## Notes

- API e2e used the already-running `postgres-test` container on port `5433`.
- The original auth branch added its own user migration before the entity PR was
  merged.
- Session 14 supersedes the auth-event implementation and duplicate user
  migration notes after rebasing onto `main`.

## Status after session

Auth implementation is complete and ready for review. Remaining V1 build slices
are unchanged; the next product slice is still #17 unless auth is reviewed first.
