<!-- wayfinder:research -->
# Template auth internals & Google-OAuth options

Type: research
Status: open

## Question

Understand the template's existing auth and lay out how Google identity + the
`.env` email allowlist (Decision 26) would attach. AFK — read + document, decide
nothing.

Read and summarise the current mechanism:
- `apps/api/src/app/auth/` — `auth.guard`, the JWT/OIDC strategy,
  `OidcDiscoveryService`, `auth-initializer.service`.
- How tokens are validated today; how the e2e tests mock OIDC
  (`__e2e-tests__/mocks/mock-oidc.service.ts`, `mock-token.factory.ts`).
- The web side: `apps/web/src/auth/` (auth provider interface, fake provider).

Then research the options for Google:
- Google Sign-In (Google Identity Services) → ID token, validated by the API,
  vs. configuring Google as a full OIDC provider against the existing discovery
  flow.
- Where the `.env` email-allowlist check belongs (guard vs. service), and how it
  composes with creating the User on first login (Decision 34).
- Dev/local story (keeping the mock-token path working).

Output: a markdown summary (linked from this ticket) of the current mechanism +
concrete options with trade-offs. Input to _Auth approach: Google OAuth + email
allowlist_.
