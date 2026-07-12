import { fixupPluginRules } from '@eslint/compat';
import dependPlugin from 'eslint-plugin-depend';

import { GLOB_SRC } from '../utils';

import type { Linter } from 'eslint';

/**
 * Dependency optimization rules — flags packages replaceable by native APIs,
 * micro-utilities, and dependencies with better-maintained alternatives.
 *
 * @see https://github.com/es-tooling/eslint-plugin-depend
 */
export const depend: Linter.Config[] = [
  {
    name: 'depend/rules',
    files: [GLOB_SRC],
    plugins: {
      depend: fixupPluginRules(dependPlugin),
    },
    rules: {
      'depend/ban-dependencies': [
        'error',
        {
          presets: ['native', 'microutilities', 'preferred'],
          allowed: [
            'dotenv', // Required by config files and utility scripts
          ],
        },
      ],
    },
  },
];
