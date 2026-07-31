# Standards: Web

Inherits: [Global standards](../../STANDARDS.md)

## Feature structure

```
src/
  features/       → Feature folders by domain (flat, no nesting)
    <feature>/    → Page component + sub-components
  components/ui/  → shadcn/ui primitives
  app/components/ → App-level components (layout, error boundaries)
  api/            → API client and hooks
  auth/           → Auth provider (strategy pattern + React context)
  i18n/           → Translations (i18next, JSON files per locale)
```

## Components

- Function components with named exports
- UI primitives in `src/components/ui/` (shadcn/ui)
- App-level components in `src/app/components/`

## API layer

- `openapi-react-query` wraps `openapi-fetch` for typed hooks from OpenAPI spec
- Query hooks: thin wrappers in `src/api/hooks/` around `$api.useQuery`/`$api.useMutation`
- Auth middleware in `src/api/middlewares/` injects bearer token
- Access generated schemas with indexed types such as
  `components['schemas']['WorkstreamDto']`. Do not use dotted access through a
  type alias; it can silently resolve to `any`.
- **API types stay in the API layer.** Feature components never import from
  `@/types/openapi` directly. Each hook file re-exports named type aliases
  (e.g. `Workstream`, `Step`, `UserSummary`) from the generated DTOs.
  Components and tests import those aliases. If the API contract changes, only
  the hook file adjusts the mapping.
- **One derived lookup, passed down.** When a query returns a flat list that
  multiple children look up by ID (e.g. `usersById`), compute the `Map` once
  in the nearest common parent and pass it as a prop — do not recompute in
  each child.
- Store selected entity IDs, then derive the selected entity from query data;
  do not keep a copied response object that can become stale.
- Mutations touch only queries whose response can change. Two refresh models
  coexist while the inline overview rework lands:
  - **Legacy, per-mutation invalidation** (`useInvalidateOverview`) — the
    advance, workstream / group / project CRUD and whole-tail pipeline hooks
    serving the pre-rework components. Leave them as they are; they die with
    their callers.
  - **The overview cache seam** (`src/api/overview-cache.ts`) — every hook
    behind the inline overview merges its response into the cached aggregate
    with `useOverviewCache` and lets one debounced, focus-deferred trailing
    invalidate reconcile the server-derived fields. Never add a per-mutation
    overview invalidation to a hook that commits through the seam.
- Note mutations patch the cached per-step `noteCount` through the seam and
  invalidate the on-demand notes query.

## Auth

- `AuthSystem` composes an `AuthSession` with its provider-specific
  `SignInButton`
- `AuthSession` — `getState`, `subscribe`, `signOut`, `getAccessToken`
- React context (`AuthContext`) + `useAuth()` for session actions,
  `useAuthState()` for state (via `useSyncExternalStore`), and
  `<SignInButton />` for identity acquisition
- `createAuthSystem()` selects and binds fake (dev/e2e) vs Google auth
- Module boundaries and what the interface deliberately excludes:
  [ADR 0007](../../docs/adr/0007-web-auth-module-boundaries.md)

## i18n

- `i18next` + `react-i18next` with browser language detection
- Flat-key JSON files in `src/i18n/locales/{en,fr,es}.json`
- Fallback language: `fr`

## Testing

- **Unit** (`*.spec.tsx`, colocated): pure functions and components with
  branching logic. Skip structural components — integration tests cover them.
- **Integration** (main layer): `renderWithApp` with real providers, mock
  HTTP via MSW (`server.use(http.get(...))`). Do not mock hooks, query
  layer, or internal components. See `src/testing/render-with-app.tsx`,
  `src/testing/mock-api.ts`.
- MSW responses must match the real API contract, including RFC 9457 Problem
  Details fields. Do not substitute transport fields such as `statusText` for
  response-body fields such as `title`.
- For journeys involving multiple requests and server-side state transitions,
  encapsulate state in a focused test adapter instead of repeating raw route
  handlers in each test.
- **Browser E2E is deferred.** Do not add Playwright coverage for now. Cover web
  journeys at the integration layer with real providers and MSW; retain the
  existing Playwright setup for when browser tests are resumed.
- Shared component mocks go in `@/testing/mocks/components.tsx`.
