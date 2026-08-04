# Standards: Global

Applies to all packages and apps in this monorepo.

## TypeScript

- Target: TypeScript 6, `strict: true`
- Imports: use path aliases (`@/`), never relative `../` across module boundaries
- File naming: kebab-case with purpose suffix (`auth.guard.ts`, `error-fallback.tsx`);
  modules holding only type declarations use `.types.ts` (`selection.types.ts`)

## Code style

- ESLint 10 (flat config) via `@workspace/eslint-config`
- Prettier for formatting
- No default exports for components or modules

## Comments

Comments explain non-obvious constraints or rationale. Do not narrate
self-explanatory code or duplicate documentation held in an ADR or
specification.

## Monorepo dependencies

Every workspace consumer must build and validate from a clean checkout without
pre-existing `dist` output. Declare workspace package dependencies and upstream
task build dependencies explicitly.
