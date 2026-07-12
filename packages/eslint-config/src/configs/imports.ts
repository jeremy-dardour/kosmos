import { importX } from 'eslint-plugin-import-x';

import { GLOB_SRC } from '../utils';

import type { Linter } from 'eslint';

/**
 * Import rules with TypeScript resolution.
 *
 * Rules duplicated by the TypeScript compiler (named, namespace, default,
 * no-unresolved, ...) are disabled for performance.
 */
export const imports: Linter.Config[] = [
  {
    name: 'imports/rules',
    files: [GLOB_SRC],
    plugins: {
      'import-x': importX,
    },
    settings: {
      ...importX.configs['flat/recommended'].settings,
      'import-x/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      ...importX.configs['flat/recommended'].rules,
      ...importX.configs['flat/typescript'].rules,

      // Redundant with the TypeScript compiler, high performance cost
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/no-unresolved': 'off',

      'import-x/newline-after-import': [
        'error',
        { count: 1, considerComments: true },
      ],
      // Import ordering with groups
      // IMPORTANT: Side-effect imports (CSS, polyfills) cannot be auto-fixed.
      // They must be manually placed LAST (after all other imports).
      // ESLint will validate but not move them.
      // See: https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/order.md#limitations-of---fix
      'import-x/order': [
        'error',
        {
          groups: [
            'builtin', // Node.js built-in modules (fs, path, etc.)
            'external', // npm packages
            'internal', // Internal modules (@/ alias)
            ['parent', 'sibling'], // Relative imports (../, ./)
            'index', // Index files (./)
            'type', // Type imports
            'object', // Side-effect imports (CSS, polyfills) - placed here via pathGroups
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
          pathGroups: [
            {
              pattern: '@/**', // @ alias paths
              group: 'internal',
              position: 'before',
            },
            // Side-effect imports (CSS, SCSS) assigned to 'object' group
            // Note: These CANNOT be auto-fixed - must be manually placed
            {
              pattern: '*.{css,scss,sass,less}',
              patternOptions: { dot: true, nocomment: true },
              group: 'object',
              position: 'before',
            },
            {
              pattern: './*.{css,scss,sass,less}',
              patternOptions: { dot: true, nocomment: true },
              group: 'object',
              position: 'before',
            },
            {
              pattern: '../**.{css,scss,sass,less}',
              patternOptions: { dot: true, nocomment: true },
              group: 'object',
              position: 'before',
            },
          ],
          pathGroupsExcludedImportTypes: ['type'],
          distinctGroup: true,
          // Off so setup side-effect imports (dotenv/config) don't warn
          warnOnUnassignedImports: false,
        },
      ],
      'import-x/consistent-type-specifier-style': 'error',

      'import-x/no-named-as-default': 'warn',
      'import-x/no-cycle': 'error',
      'import-x/no-unused-modules': 'off',
      'import-x/no-deprecated': 'warn',
      'import-x/no-extraneous-dependencies': 'error',
    },
  },
];

/**
 * Disallow `../` relative imports — use the `@/` path alias instead.
 */
export const noRelativeImports: Linter.Config = {
  name: 'imports/no-relative-parent-imports',
  files: [GLOB_SRC],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../*', '../**'],
            message: 'Use @/ path alias instead of ../ relative imports',
          },
        ],
      },
    ],
  },
};
