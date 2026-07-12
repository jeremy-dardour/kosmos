import reactPlugin from '@eslint-react/eslint-plugin';
import reactQuery from '@tanstack/eslint-plugin-query';
import { defineConfig } from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

import { GLOB_JSX } from '../utils';

import type { Linter } from 'eslint';

/**
 * React rules: @eslint-react, hooks, react-refresh, TanStack Query
 */
export const react: Linter.Config[] = defineConfig({
  name: 'react/rules',
  files: [GLOB_JSX],
  extends: [
    reactPlugin.configs['recommended-typescript'],
    reactHooksPlugin.configs.flat['recommended-latest'],
    reactRefresh.configs.recommended,
    reactQuery.configs['flat/recommended'],
  ],
  settings: {
    react: {
      version: 'detect',
    },
  },
});
