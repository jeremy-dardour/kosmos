import { boundariesModules, node } from '@workspace/eslint-config';

export default [
  ...node(import.meta.dirname),
  // Module boundary checks for VSA/DDD
  ...boundariesModules,
  {
    files: ['**/package.json'],
    rules: {
      'package-json/valid-devDependencies': 'off', // Allow link: local deps
      'package-json/require-type': 'off', // CJS Nest build has no "type" field
    },
  },
  {
    files: ['**/*Migration*.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      'unicorn/filename-case': 'off',
    },
  },
];
