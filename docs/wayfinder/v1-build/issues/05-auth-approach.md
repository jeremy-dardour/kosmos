<!-- wayfinder:grilling -->

# Auth approach: Google OAuth + email allowlist

Type: grilling
Status: resolved
Blocked by: 02

## Question

Given the research from ticket 02, decide the concrete auth wiring for V1.

Decide:

- **Google identity** — how it's obtained on the web and validated by the API
  (Google ID token vs. full OIDC provider config against the existing flow).
- **Allowlist gate** — where the `.env` email-allowlist check lives (guard vs.
  service), and its failure behaviour (Decision 26: access gated outside the app,
  no in-app whitelist).
- **User provisioning** — creating the User record on first login with email +
  name + avatar (Decision 34).
- **Template changes** — what changes to `apps/api/src/app/auth/` and the web
  auth provider are needed; how the e2e mock-token path stays working.
- **Dev/local** — signing in locally without real Google.

Output: the auth wiring decision (candidate ADR) + any schema/API follow-ons.
Input to _Sequence V1_.

## Answer

Decision: **GIS + static `.env` allow-list**, consent screen published "In
production" (non-sensitive scopes only: `openid email profile`). Full details in
the implementation spec: [docs/specs/auth/PRD.md](../../../specs/auth/PRD.md).
