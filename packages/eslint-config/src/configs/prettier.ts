import eslintConfigPrettier from 'eslint-config-prettier/flat';

import type { Linter } from 'eslint';

/**
 * Disables every stylistic rule that conflicts with Prettier.
 * Formatting itself is owned by the standalone `prettier` CLI —
 * ESLint never runs Prettier. Must come after all rule-adding configs.
 */
export const prettier: Linter.Config = {
  ...eslintConfigPrettier,
  name: 'prettier/disable-conflicts',
};
