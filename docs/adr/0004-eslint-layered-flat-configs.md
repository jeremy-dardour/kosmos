# ADR 0004: ESLint config is layered flat-config exports, not an options factory

**Status:** Accepted — 2026-07

## Context

`@workspace/eslint-config` was inherited as a `composeConfig(options)`
factory: every concern took a `boolean | Options` union, rule overrides were
threaded through per-module `overrides` parameters, and unused machinery
(presets, option types, dead dependencies) accumulated. The package has
exactly two app consumers plus itself, and this template's direction is
fork-and-go, not npm-published configurability.

The abstraction was also redundant: ESLint flat config already _is_ a
composition mechanism — arrays evaluate top to bottom and the last matching
entry wins — so the factory's `overrides` plumbing re-implemented what
appending a plain `{ files, rules }` object does natively.

## Decision

Two layers, no options objects:

- **Primitives** — one exported flat-config array per concern (`typescript`,
  `imports`, `react`, `boundariesModules`, ...). The only parameter anywhere
  is `tsconfigRootDir`, which genuinely varies per package.
- **Presets** — `base(rootDir)` composes what every package shares;
  `node(rootDir)` and `web(rootDir)` build on it and put `prettier` last.

Customization is native flat config: spread a preset, append override
objects after it. Opting out of a concern means composing primitives instead
of passing a flag. Formatting is owned by the standalone Prettier CLI;
ESLint carries only `eslint-config-prettier` to disable conflicting rules.

## Consequences

- App configs are 3–15 lines of plain ESLint; there is no package-specific
  API to learn beyond the export names.
- Behavior that used to be an option (boundaries elements, import-order
  tweaks) is hardcoded to what this repo uses. Forks that need different
  values edit the workspace package directly — it is code they own.
- Adding a new package shape means composing primitives (and, if it recurs,
  adding a preset) rather than extending an options interface.
- Do not reintroduce an options/overrides plumbing layer; appending flat
  config objects is the override mechanism.
