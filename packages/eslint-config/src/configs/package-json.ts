import { defineConfig } from 'eslint/config';
import plugin from 'eslint-plugin-package-json';

import type { Linter } from 'eslint';

/**
 * package.json consistency rules (recommended + stylistic)
 *
 * @see https://github.com/JoshuaKGoldberg/eslint-plugin-package-json
 */
export const packageJson: Linter.Config[] = defineConfig({
  name: 'package-json/rules',
  plugins: {
    'package-json': plugin,
  },
  extends: [plugin.configs.recommended],
  rules: {
    ...plugin.configs.stylistic.rules,
    'package-json/valid-local-dependency': 'off', // Allow link: local dependencies
  },
});
