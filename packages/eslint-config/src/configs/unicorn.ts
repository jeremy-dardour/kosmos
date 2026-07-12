import { defineConfig } from 'eslint/config';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

import { GLOB_SRC } from '../utils';

import type { Linter } from 'eslint';

/**
 * Unicorn best practices (recommended set with workspace adjustments)
 */
export const unicorn: Linter.Config[] = defineConfig({
  name: 'unicorn/rules',
  files: [GLOB_SRC],
  extends: [eslintPluginUnicorn.configs.recommended],
  rules: {
    // Modern libraries like MikroORM and react-query use null by default
    'unicorn/no-null': 'off',
    'unicorn/name-replacements': 'off',
    'unicorn/no-non-function-verb-prefix': 'off',
    'unicorn/no-top-level-side-effects': 'off',
    'unicorn/consistent-class-member-order': 'off',
    'unicorn/no-array-sort': 'off',
    'unicorn/filename-case': [
      'error',
      { case: 'kebabCase', ignore: [/^__[\w-]+__$/.source] },
    ],
  },
});
