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

## Auth

- Strategy interface: `AuthProvider` with `initialize`, `login`, `logout`, `getAccessToken`
- React context (`AuthContext`) + `useAuth()` hook
- Factory selects `FakeAuthProvider` (dev) vs real OIDC based on config

## i18n

- `i18next` + `react-i18next` with browser language detection
- Flat-key JSON files in `src/i18n/locales/{en,fr,es}.json`
- Fallback language: `fr`

## Testing

- Unit: `@testing-library/react` + vitest, colocated `*.spec.tsx`
- E2E: Playwright in `e2e/`, custom fixtures with `ApiMock` for deterministic API interception
- Mocks for `@/components` or design-system components go in `@/testing/mocks/components.tsx` so they can be reused across specs
