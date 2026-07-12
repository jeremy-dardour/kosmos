import { fixupPluginRules } from '@eslint/compat';
import vitestPlugin from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';

import { GLOB_TESTS, isInEditorEnv } from '../utils';

import type { Linter } from 'eslint';

const isInEditor = isInEditorEnv();

/**
 * Vitest testing rules
 *
 * - Relaxes general rules for test code (no-console, ts-comment escapes, ...)
 * - Enforces test quality: .skip/.only warn in editors, error in CI
 */
export const vitest: Linter.Config[] = defineConfig([
  {
    name: 'vitest/rules',
    files: GLOB_TESTS,
    plugins: {
      vitest: fixupPluginRules(vitestPlugin),
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,

      // Relax rules for test code
      'no-console': 'off',
      'no-restricted-globals': 'off',
      'no-restricted-syntax': 'off',
      'no-undef': 'off', // TypeScript handles type checking
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/unbound-method': 'off', // Mock methods don't need binding
      'unicorn/no-null': 'off', // Returning null in mocks is reasonable

      // Test code style consistency
      'vitest/consistent-test-it': [
        'error',
        { fn: 'it', withinDescribe: 'it' },
      ],
      'vitest/no-identical-title': 'error',
      'vitest/prefer-hooks-in-order': 'error',
      'vitest/prefer-lowercase-title': 'error',

      // Test quality assurance (warning in editor, error in CI)
      'vitest/no-disabled-tests': isInEditor ? 'warn' : 'error',
      'vitest/no-focused-tests': isInEditor ? 'warn' : 'error',
    },
    settings: {
      vitest: {
        typecheck: true,
      },
    },
  },
]);
