import { node } from './src/index';

import type { Linter } from 'eslint';

const config: Linter.Config[] = [
  ...node(import.meta.dirname),
  {
    // This package has no @/ path alias; relative imports are the idiom here
    rules: {
      'no-restricted-imports': 'off',
    },
  },
];
export default config;
