# Standards: Global

Applies to all packages and apps in this monorepo.

## TypeScript

- Target: TypeScript 6, `strict: true`
- Imports: use path aliases (`@/`), never relative `../` across module boundaries
- File naming: kebab-case with purpose suffix (`auth.guard.ts`, `error-fallback.tsx`)

## Code style

- ESLint 10 (flat config) via `@workspace/eslint-config`
- Prettier for formatting
- No default exports for components or modules
