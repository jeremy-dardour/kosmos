# @workspace/typescript-config

Shared TypeScript configuration presets for the monorepo. Every preset extends
`tsconfig.base.json`, so strictness decisions are made once and inherited
everywhere; the presets only add what their runtime scenario needs
(module system, JSX, DOM types, emit strategy).

## How it works

```
tsconfig.base.json          ← strictness + code quality, no emit/module choices
├── tsconfig.nestjs.json    ← NodeNext, decorators + metadata, emits d.ts/sourcemaps
├── tsconfig.vite.json      ← module: preserve, react-jsx, DOM libs, noEmit (Vite compiles)
├── tsconfig.library.json   ← bundler resolution, isolatedDeclarations, noEmit
└── tsconfig.vitest.json    ← vitest/globals + DOM types, relaxed unused-checks for tests
```

| Config                  | Used by                                        |
| ----------------------- | ---------------------------------------------- |
| `tsconfig.base.json`    | Everything (via the presets)                   |
| `tsconfig.nestjs.json`  | `apps/api`                                     |
| `tsconfig.vite.json`    | `apps/web`                                     |
| `tsconfig.library.json` | `packages/*` (shared utilities, eslint-config) |
| `tsconfig.vitest.json`  | Test tsconfigs layered over an app preset      |

### What the base locks in

- **Strictness**: `strict`, `noUncheckedIndexedAccess` (index access returns
  `T | undefined`), `noImplicitOverride`.
- **Code quality**: `noUnusedLocals`/`noUnusedParameters` (prefix with `_` to
  opt out), `noFallthroughCasesInSwitch`, `noImplicitReturns`.
- **Tooling compatibility**: `isolatedModules` + `moduleDetection: force` so
  every file transpiles independently under SWC/esbuild.
- **Deliberately off**: `exactOptionalPropertyTypes` — the extra precision
  costs too much friction with third-party types.

The base makes no `module`, `noEmit`, or `declaration` choices — those are
scenario decisions and belong to the presets.

## Usage

In a package or app `tsconfig.json`, extend the preset matching your runtime
and add only project-specific paths:

```json
{
  "extends": "@workspace/typescript-config/tsconfig.nestjs.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

Adding a new package: pick the preset whose emit strategy matches
(backend service → `nestjs`, browser app → `vite`, bundler-built package →
`library`), and keep overrides in the package's own tsconfig to the minimum —
if an override would make sense for every package, it belongs in the base.
