import { defineConfig } from 'eslint/config';
import { configs, parser, plugin } from 'typescript-eslint';

import { GLOB_TS } from '../utils';

import type { Linter } from 'eslint';

/**
 * Type-checked TypeScript rules.
 *
 * @param tsconfigRootDir - Always pass `import.meta.dirname` from the app's
 * eslint config. Without it typescript-eslint falls back to `process.cwd()`,
 * which breaks whenever ESLint runs from another directory (IDE integrations,
 * repo-root invocations).
 */
export function typescript(tsconfigRootDir: string): Linter.Config[] {
  return defineConfig([
    {
      name: 'typescript/rules',
      files: [GLOB_TS],
      plugins: {
        '@typescript-eslint': plugin,
      },
      extends: [configs.recommendedTypeChecked, configs.stylisticTypeChecked],
      languageOptions: {
        parser: parser,
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
        // For global variables in TS, `no-undef` is redundant with the compiler
        // Reference: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
        '@typescript-eslint/no-unused-vars': 'off', // Works with tsconfig.verbatimModuleSyntax, e.g., `import type {ReactNode} from 'react'`
        // Deprecated API detection (replaces eslint-plugin-n's no-deprecated-api)
        '@typescript-eslint/no-deprecated': 'warn',
        // Disable no-inferrable-types because project uses isolatedDeclarations
        // TypeScript's isolatedDeclarations requires explicit type annotations for exports
        // Reference: https://typescript-eslint.io/rules/no-inferrable-types/#when-not-to-use-it
        '@typescript-eslint/no-inferrable-types': 'off',
        '@typescript-eslint/no-misused-promises': [
          'error',
          {
            checksVoidReturn: {
              attributes: false, // Allow returning Promise in JSX attributes
            },
          },
        ],
      },
    },
    {
      // ESLint config files may live outside the app's tsconfig project
      // (their imports resolve bundler-style, which NodeNext projects can't
      // type), so type-aware rules are disabled for them.
      name: 'typescript/disable-type-checked-for-eslint-configs',
      files: ['**/eslint.config.mts'],
      extends: [configs.disableTypeChecked],
    },
  ]);
}
