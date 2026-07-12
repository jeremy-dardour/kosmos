import { defineConfig } from 'eslint/config';
import boundariesPlugin from 'eslint-plugin-boundaries';

import type { Linter } from 'eslint';

/**
 * VSA/DDD module boundaries for the API layout:
 *
 * - `module`  (src/modules/*)  may import: itself, shared, app, main
 * - `shared`  (src/shared)     may import: shared only
 * - `app`     (src/app)        may import: app, shared
 * - `main`    (src/main.ts, src/*.module.ts) may import anything
 *
 * Business modules cannot import each other — share code via `shared`
 * or decouple via events.
 */
export const boundariesModules: Linter.Config[] = defineConfig([
  {
    name: 'boundaries/modules',
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: {
      boundaries: boundariesPlugin,
    },
    settings: {
      'boundaries/elements': [
        {
          type: 'module',
          pattern: 'src/modules/*/**',
          capture: ['moduleName'],
          mode: 'folder',
        },
        {
          type: 'shared',
          pattern: 'src/shared/**',
          mode: 'folder',
        },
        {
          type: 'app',
          pattern: 'src/app/**',
          mode: 'folder',
        },
        {
          type: 'main',
          pattern: ['src/main.ts', 'src/*.module.ts', 'src/*.d.ts'],
          mode: 'file',
        },
      ],
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
      // Ignore test files
      'boundaries/ignore': ['**/*.spec.ts', '**/*.test.ts', '**/*.e2e-spec.ts'],
      // Configure TypeScript path resolver
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: ['module'],
              allow: [
                // Same-module imports (matched via the moduleName capture group)
                ['module', { moduleName: '${moduleName}' }],
                'shared',
                'app',
                'main',
              ],
              message:
                'Modules cannot import each other. Use shared for shared code or decouple via events',
            },
            {
              from: ['shared'],
              allow: ['shared'],
              message: 'shared cannot import other modules',
            },
            {
              from: ['app'],
              allow: ['app', 'shared'],
              message:
                'app layer should not directly depend on business modules',
            },
            {
              from: ['main'],
              allow: ['module', 'shared', 'app', 'main'],
            },
          ],
        },
      ],

      // Prevent external modules from importing private elements
      'boundaries/no-private': 'error',

      // Disabled: .d.ts and config files may not match element definitions
      'boundaries/no-unknown-files': 'off',
      // Disabled: external dependencies (node_modules) trigger false positives
      'boundaries/no-unknown': 'off',
    },
  },
]);
