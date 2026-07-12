# @workspace/eslint-config

Shared ESLint flat configs for the monorepo, organized in two layers:

1. **Presets** — what apps normally use. One function call, done.
2. **Primitives** — per-concern config arrays the presets are built from.
   Compose them directly for packages that don't fit a preset.

There is no options object to configure. Customization is plain ESLint flat
config: spread a preset, then append `{ files, rules }` objects after it —
later entries win.

## Presets

| Preset          | Contents                                                                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `base(rootDir)` | Everything shared: ignores, typescript, imports, stylistic, unicorn, depend, package-json, no-relative-imports. **No `prettier`** — compositions must append it last. |
| `node(rootDir)` | `base` + vitest + prettier. For backend/Node packages.                                                                                                                |
| `web(rootDir)`  | `base` + react + a11y + vitest + prettier. For React apps.                                                                                                            |

`rootDir` is the directory containing the app's `tsconfig.json` — always pass
`import.meta.dirname`. It anchors typescript-eslint's project service so
linting works identically from the repo root, the app directory, and IDEs.

### Usage

```ts
// apps/web/eslint.config.mts
import { web } from '@workspace/eslint-config';

export default web(import.meta.dirname);
```

```ts
// apps/api/eslint.config.mts — preset + addon + overrides
import { boundariesModules, node } from '@workspace/eslint-config';

export default [
  ...node(import.meta.dirname),
  ...boundariesModules, // opt-in addon
  {
    // plain flat-config override, last one wins
    files: ['**/*Migration*.ts'],
    rules: { 'unicorn/filename-case': 'off' },
  },
];
```

## Primitives

| Export                | Concern                                                |
| --------------------- | ------------------------------------------------------ |
| `ignores`             | Default ignore patterns + the package's `.gitignore`   |
| `typescript(rootDir)` | Type-checked TypeScript rules (typescript-eslint)      |
| `imports`             | Import ordering/resolution (import-x, TS resolver)     |
| `noRelativeImports`   | Bans `../` imports in favor of the `@/` alias          |
| `stylistic`           | Code style rules (@stylistic)                          |
| `unicorn`             | Unicorn best practices                                 |
| `depend`              | Flags replaceable/heavyweight dependencies             |
| `packageJson`         | package.json consistency rules                         |
| `react`               | @eslint-react, hooks, react-refresh, TanStack Query    |
| `a11y`                | Accessibility rules (jsx-a11y)                         |
| `vitest`              | Vitest test rules (`.only`/`.skip` error in CI)        |
| `boundariesModules`   | VSA/DDD module boundaries (`src/modules/*` isolation)  |
| `prettier`            | Disables rules that conflict with Prettier — keep last |

A package with a shape the presets don't cover composes primitives directly:

```ts
import {
  ignores,
  typescript,
  imports,
  prettier,
} from '@workspace/eslint-config';

export default [
  ...ignores,
  ...typescript(import.meta.dirname),
  ...imports,
  prettier, // always last
];
```

## How overriding works

Flat config evaluates the array top to bottom; when a file matches several
entries, **the last matching entry wins for each rule**. That gives three
moves, all plain ESLint — nothing package-specific to learn:

1. **Change or disable a rule** — append `{ rules: { ... } }` after the
   preset spread.
2. **Scope it** — add `files: ['**/*Migration*.ts']` to the same object so
   the override only hits matching files.
3. **Drop a whole concern** — presets have no opt-out flags; compose
   primitives yourself instead (see above). Editing this package is also
   fine — it's workspace-owned, not a published dependency.

Ordering caveat: `prettier` sits last inside each preset and only _disables_
conflicting rules. Configs you append come after it, so if an override
_enables_ a formatting-related stylistic rule, config-prettier will not
neutralize it — don't add rules Prettier already owns.

The switch from the old `composeConfig(options)` factory to this layout is
documented in
[ADR 0004](../../docs/adr/0004-eslint-layered-flat-configs.md).

## Formatting

Formatting is owned by the standalone Prettier CLI (`pnpm format` /
`prettier --check` in CI). ESLint never runs Prettier; the `prettier` export
only disables conflicting stylistic rules. That keeps lint fast and formatting
configured in exactly one place (`prettier.config.mjs`).

## Scripts

- `pnpm lint` — Run ESLint on this package
- `pnpm lint:fix` — Run ESLint with auto-fix
- `pnpm format` — Alias for `lint:fix`
- `pnpm check-types` — Run TypeScript type checking
