# Standards: Web

Inherits: [Global standards](../../STANDARDS.md)

## Feature structure

```
src/
  features/       → Feature folders by domain
    <feature>/    → Page component + components, one file each, flat —
                    except that a composite component and its subcomponents
                    share one folder named after the composite. A component
                    used by several parents is shared, not a subcomponent:
                    it stays at the feature root. No barrel/index files.
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
- `react-refresh/only-export-components` forbids non-component exports from
  component files — hooks, predicates, and constants shared with a component
  get their own module rather than an eslint-disable

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
- Mutations touch only queries whose response can change, via one of two
  deliberate refresh models:
  - **Inline overview mutations commit through the cache seam**
    (`src/api/overview-cache.ts`): the hook merges its response into the
    cached aggregate with `useOverviewCache` and one debounced,
    focus-deferred trailing invalidate reconciles the server-derived fields.
    Never add a per-mutation overview invalidation to a hook that commits
    through the seam.
  - **Dialog mutations invalidate** (`useInvalidateOverview`): workstream
    create/delete, group CRUD, project settings — flows whose responses are
    not patchable into the aggregate and where a full refetch after a dialog
    closes is the right cost.
  - One sanctioned crossover: reorder mutations commit through the seam but
    recover from a rejected drag by invalidating in `onError` — the stale
    optimistic order is forgotten whole and the server's order re-renders.
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
