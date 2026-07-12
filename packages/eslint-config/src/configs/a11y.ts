import { defineConfig } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';

import { GLOB_JSX } from '../utils';

import type { Linter } from 'eslint';

/**
 * Accessibility rules for JSX
 */
export const a11y: Linter.Config[] = defineConfig({
  name: 'a11y/rules',
  files: [GLOB_JSX],
  extends: [jsxA11y.flatConfigs.recommended],
});
