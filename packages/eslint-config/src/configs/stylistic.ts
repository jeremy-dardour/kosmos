import stylisticPlugin from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';

import { GLOB_SRC } from '../utils';

import type { Linter } from 'eslint';

/**
 * Stylistic code style rules (indentation, quotes, commas, etc.)
 *
 * Philosophy:
 * - Minimal: single quotes, 2-space indent, semicolons
 * - Consistent: trailing commas in multiline, always parens for arrow functions, 1tbs brace style
 * - Aesthetic: object spacing, JSX follows HTML double-quote tradition
 */
export const stylistic: Linter.Config[] = defineConfig({
  name: 'stylistic/rules',
  files: [GLOB_SRC],
  extends: [
    stylisticPlugin.configs.customize({
      indent: 2,
      semi: true,
      quotes: 'single',
      quoteProps: 'consistent-as-needed',
      commaDangle: 'always-multiline',
      arrowParens: true,
      blockSpacing: true,
      braceStyle: '1tbs',
      jsx: true,
    }),
  ],
});
