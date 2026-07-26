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

## Comments

- Comment non-obvious edge cases, workarounds, and constraints that would
  otherwise be re-broken. Never restate what the code already says.
- Rationale that belongs in an ADR lives in the ADR — link it, don't duplicate
  it. One home per fact.
- JSDoc only when the signature cannot say it: a non-obvious precondition, a
  unit or format the type doesn't encode, or why this approach and not the
  obvious alternative. Prose that merely renames the function is noise.
- When a JSDoc block is warranted, open with one line saying what the function
  does, then list the edge cases or constraints as bullets, each with its
  reason.
