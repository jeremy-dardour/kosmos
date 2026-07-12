# Template Web

React + Vite frontend for the TypeScript Fullstack Template. Consumes OpenAPI-generated types and provides a modern, maintainable UI built with shadcn/ui.

## Features

- **React 19** with [SWC](https://swc.rs/) for Fast Refresh
- **Vite 8** for dev server and builds
- **shadcn/ui** (Tailwind CSS 4 + Base UI) for components
- **TanStack Query 5** for data fetching and caching
- **OpenAPI types** auto-generated from the backend contract
- **i18n** via react-i18next (English, French, Spanish)
- **Playwright** for E2E testing, **Vitest** for unit testing

## File Structure

```
apps/web/src/
  api/          # OpenAPI client, TanStack Query hooks, middlewares
  app/          # App entry, providers, layout, error handling
  auth/         # Authentication context and providers
  components/
    ui/         # shadcn/ui primitives (Button, Dialog, Table, etc.)
  config/       # App-wide configuration
  errors/       # API error context and handling
  features/     # Feature modules organized by domain
  i18n/         # Localization (en.json, fr.json, es.json)
  lib/          # Utilities (cn, etc.)
  testing/      # Test setup and utilities
```

## Development Standards

- All API types are generated from OpenAPI (`@workspace/api-contracts`) — never define them manually
- Data fetching logic is separated from UI components via custom hooks
- Features are organized by domain in `src/features/`
- UI primitives live in `src/components/ui/` (managed by shadcn/ui CLI)
- Translation key structure: `page.component.subComponent`

## Scripts

| Script                 | Description                  |
| ---------------------- | ---------------------------- |
| `pnpm dev`             | Start in dev mode            |
| `pnpm build`           | Build for production         |
| `pnpm preview`         | Preview production build     |
| `pnpm test`            | Run unit tests               |
| `pnpm test:cov`        | Unit tests with coverage     |
| `pnpm test:e2e`        | Playwright E2E tests         |
| `pnpm test:e2e:headed` | E2E tests in headed mode     |
| `pnpm test:e2e:ui`     | E2E tests with Playwright UI |
| `pnpm lint`            | ESLint                       |
| `pnpm check-types`     | TypeScript type checking     |
