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

## Known context / constraints (added by owner)

- **The allow-list mechanism is not settled — reconcile it.** The decisions log
  and a stated preference disagree, so research **all three** mechanisms rather
  than assuming Decision 26 is final:
  1. **Google OAuth app allowed-users list** (OAuth consent-screen test/allowed
     users) — what Decision 26 currently prefers.
  2. **Google Group membership** (a group is maintained; the app checks
     membership via the Directory/Groups API) — owner's stated *ideal*, but
     Decision 19 (superseded) rejected it as "awkward on consumer Gmail." Re-test
     that claim: is it awkward on **consumer Gmail** vs. a **Workspace** domain?
  3. **Static `.env` allow-list** — agreed fallback / "plan B" under all readings.
- For **each** mechanism, answer the decisive question: **can a new helper be
  added without a redeploy** and without touching the Google Cloud console? This
  is the main reason the group option is attractive.
- **Confirmed: personal Gmail accounts, no common Workspace domain.** This makes
  the Google Group option (2) hard — the Directory/Groups API for membership
  lookups generally needs a Workspace admin context, not consumer Gmail. Research
  should *confirm* how far you can get (e.g. a public/shared group + any readable
  membership signal) but expect the realistic contenders to be the **OAuth
  allowed-users list** and the **`.env` list**. If group-gating is truly
  impractical here, say so plainly so the decision can rest on 1 vs 3.
- This research may lead the _Auth approach_ decision to **revise Decision 26**.

