# @workspace/shared

Shared utilities and business logic used by both the API and the web app. This package provides a place for cross-cutting concerns that must stay in sync between frontend and backend.

## When to use this package

Place code here when:

- The same logic is needed in both `apps/api` and `apps/web`
- A change in one app must be reflected in the other (e.g., validation rules, formatting, constants)
- The code is pure (no framework-specific dependencies)

Do **not** place code here if it is only used by one app — keep it in that app instead.

## Exports

Each export is an explicit entry in `package.json` `"exports"` and maps to a source file in `src/`.

| Export                          | Description             |
| ------------------------------- | ----------------------- |
| `@workspace/shared/format-date` | Date formatting utility |

## Adding a new export

1. Create your module in `src/my-module.ts`
2. Add the export entry to `package.json`:

```json
"./my-module": {
  "types": "./dist/my-module.d.ts",
  "import": "./dist/my-module.js",
  "require": "./dist/my-module.cjs"
}
```

3. Add the entry to `tsup.config.ts` in the `entry` map
4. Run `pnpm build` to verify

## Scripts

| Script             | Description                                |
| ------------------ | ------------------------------------------ |
| `pnpm build`       | Build the package (tsup: ESM + CJS + d.ts) |
| `pnpm dev`         | Rebuild on change (`tsup --watch`)         |
| `pnpm check-types` | TypeScript type checking                   |
| `pnpm test`        | Run tests                                  |

## Rules

- Only genuinely shared logic belongs here
- Each export must be declared in `package.json` exports
- Built output goes to `dist/` (gitignored)
- Keep dependencies minimal — this package should stay framework-agnostic
