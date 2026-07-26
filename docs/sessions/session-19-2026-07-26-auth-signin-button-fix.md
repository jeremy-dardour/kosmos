# Session 19 — Sign-in button diagnosis and auth boundaries (2026-07-26)

Continues [session 18](./session-18-2026-07-25-auth-unauthenticated-ux-wip.md),
which left the sign-in button slot rendering empty with no error.

## What was done

- **Diagnosed the empty sign-in button.** The button _was_ rendering, then being
  deleted by its own cleanup: `renderSignInButton` returned
  `() => container.replaceChildren()`, which clears the whole container rather
  than the node it created. Under React StrictMode's double-invoked effect, the
  first call's cleanup ran after the second call had rendered, wiping the live
  button. Evidence: two `gsi/button` requests with distinct `iframe_id`s, both
  `ERR_ABORTED`; manual `renderButton` into the same empty slot worked; the
  production build (no StrictMode) rendered correctly.
- **Fixed it** by rendering into a provider-owned node whose cleanup removes
  only itself, in both `GoogleAuthProvider` and `FakeAuthProvider`. Added a
  regression test for two overlapping renders plus a stale cleanup.
- **Extracted `GET /api/users/me`** out of `GoogleAuthProvider` into
  `apps/web/src/api/current-user.ts`, typed from the generated `CurrentUserDto`
  instead of a hand-written interface and an unchecked cast. Added a
  `token_rejected` `AuthErrorCode` so "server refused the token" (→ sign-in)
  stays distinct from "validation could not complete" (→ error state); that
  distinction previously rode on a private status-carrying error class.
- **Deleted the unreachable `403` branch** in the API auth middleware, plus its
  URL-sniffing helper and tests.
- **Rewrote the unauthenticated landing** — removed hardcoded filler content
  including a venue name, moved all strings into i18next (`auth.landing.*` in
  en/fr/es, registered in the typed `Translations` interface).
- Fixed `apps/web/src/types/openapi.d.ts`, where `components.schemas` (qualified
  access on an interface) silently resolved to `any`. Not the generated
  contract file — that is untouched.
- Installed the Playwright MCP (user scope) and added a **Ports** section to
  `CLAUDE.md`.
- **Diagnosed a `500` on `/api/users/me`** after a real Google sign-in: not a
  code bug — this workspace's dev database had no tables at all, so token
  verification succeeded and then `AuthUserProvisionerService.provision()` hit a
  missing `user` relation. Ran `pnpm --filter api db:migrate:up`; end-to-end
  Google login then worked.

Checks: `check-types`, `lint`, `test` (72 web tests) green monorepo-wide; web
e2e passes; landing verified in a real browser.

## Decisions

- Web auth module boundaries recorded in
  [ADR 0007](../adr/0007-web-auth-module-boundaries.md), which supersedes the
  frontend-flow steps in [V1 Tech Design § Auth](../specs/v1-tech-design.md#auth).
- Collapsing `AuthProvider` to `getState()` + `subscribe()` deferred to
  [issue #33](https://github.com/jeremy-dardour/wedding-planner/issues/33) to
  keep this a bug fix plus scoped cleanups.
- Fake auth's purpose is narrowed explicitly: make web + API e2e-testable
  without Google. Multi-user dev switching, moving the allow-list into
  `MockAuthStrategy`, and MSW were all considered and rejected as solving
  problems the project does not have.

## Learnings / tensions surfaced

- **Session 18's recommended fix would not have worked.** It proposed a
  "Preparing Google sign-in…" loading state and a fallback button on failure,
  based on the hypothesis that GIS was slow or failing. `renderSignInButton`
  actually _resolved successfully_ — nothing ever threw, so the fallback path
  was unreachable and a spinner would have revealed the same empty box. The
  evidence to catch this (the network panel) was available but not consulted.
- **Memoizing the boundary's context object breaks auth propagation.** Tried it
  as an optimisation; two tests failed immediately. React context propagates by
  value identity, so a stable object means consumers never re-render. Reverted
  with an explanatory comment — it is an inviting-looking change that silently
  breaks the app.
- **`notify: false` on the expiry clear was defensible, not a bug.**
  `isAuthenticated()` is called during render, so emitting synchronously would
  set state mid-render. Kept the guard, made the notification async instead.
- Web e2e coverage is currently **one placeholder assertion**; `items.spec.ts`
  is fully commented out and `ApiMock` still mocks the deleted `/api/items`.
  The infrastructure exists but there is no safety net — real specs belong with
  the overview slices (#18+).
- Two Vite dev servers can run simultaneously without it being obvious: Vite
  silently takes the next free port when `WEB_PORT` is occupied, and binds IPv6
  `localhost` only, so `127.0.0.1` fails. Now documented in `CLAUDE.md § Ports`.
- A fresh parallel workspace starts with an **empty** dev database — the setup
  script provisions ports, not schema. Symptom is a `500` from any endpoint that
  touches the DB, including auth. Worth running `db:migrate:up` before
  concluding anything about auth code.

## Status at end of session

The unauthenticated landing works in dev and production: one Google button,
no console errors, no hardcoded personal content, fully translated. All four
planned items shipped and uncommitted on `auth-v1.1`. Next: commit and take
PR #32 through a final review pass, then start #18 (overview build slices).
Auth interface collapse waits on #33.
