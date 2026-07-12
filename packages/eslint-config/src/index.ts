/**
 * @workspace/eslint-config
 *
 * Layered ESLint flat configs:
 *
 * - **Presets** — what apps normally use:
 *   `node(rootDir)` for backend/Node packages, `web(rootDir)` for React apps.
 * - **Primitives** — per-concern config arrays (typescript, imports, react, ...)
 *   for packages that don't fit a preset. Compose them yourself and put
 *   `prettier` last.
 *
 * Overrides are plain flat-config objects appended after the spread —
 * last one wins:
 *
 * @example
 * ```typescript
 * import { node, boundariesModules } from '@workspace/eslint-config';
 *
 * export default [
 *   ...node(import.meta.dirname),
 *   ...boundariesModules,
 *   { files: ['**\/*Migration*.ts'], rules: { 'unicorn/filename-case': 'off' } },
 * ];
 * ```
 */

import { a11y } from './configs/a11y';
import { depend } from './configs/depend';
import { ignores } from './configs/ignores';
import { imports, noRelativeImports } from './configs/imports';
import { packageJson } from './configs/package-json';
import { prettier } from './configs/prettier';
import { react } from './configs/react';
import { stylistic } from './configs/stylistic';
import { typescript } from './configs/typescript';
import { unicorn } from './configs/unicorn';
import { vitest } from './configs/vitest';

import type { Linter } from 'eslint';

// ============================================================================
// Presets
// ============================================================================

/**
 * Everything shared by all packages. Does NOT include `prettier` —
 * presets (or your own composition) must append it last.
 *
 * @param tsconfigRootDir - Pass `import.meta.dirname` from the app's eslint config
 */
export function base(tsconfigRootDir: string): Linter.Config[] {
  return [
    ...ignores,
    ...typescript(tsconfigRootDir),
    ...imports,
    ...stylistic,
    ...unicorn,
    ...depend,
    ...packageJson,
    noRelativeImports,
  ];
}

/**
 * Preset for backend/Node packages (NestJS API, libraries)
 *
 * @param tsconfigRootDir - Pass `import.meta.dirname` from the app's eslint config
 */
export function node(tsconfigRootDir: string): Linter.Config[] {
  return [...base(tsconfigRootDir), ...vitest, prettier];
}

/**
 * Preset for React apps
 *
 * @param tsconfigRootDir - Pass `import.meta.dirname` from the app's eslint config
 */
export function web(tsconfigRootDir: string): Linter.Config[] {
  return [...base(tsconfigRootDir), ...react, ...a11y, ...vitest, prettier];
}

// ============================================================================
// Primitives
// ============================================================================

export { a11y } from './configs/a11y';
export { boundariesModules } from './configs/boundaries';
export { depend } from './configs/depend';
export { ignores } from './configs/ignores';
export { imports, noRelativeImports } from './configs/imports';
export { packageJson } from './configs/package-json';
export { prettier } from './configs/prettier';
export { react } from './configs/react';
export { stylistic } from './configs/stylistic';
export { typescript } from './configs/typescript';
export { unicorn } from './configs/unicorn';
export { vitest } from './configs/vitest';

export {
  GLOB_SRC,
  GLOB_JS,
  GLOB_TS,
  GLOB_JSX,
  GLOB_TESTS,
  GLOB_JSON,
  GLOB_MARKDOWN,
} from './utils';
