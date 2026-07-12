import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { includeIgnoreFile } from '@eslint/config-helpers';

import type { Linter } from 'eslint';

/**
 * Default ignored files and directories
 */
export const DEFAULT_IGNORES: string[] = [
  // Dependencies
  '**/node_modules/**',
  '**/.pnp.*',

  // Build outputs
  '**/dist/**',
  '**/build/**',
  '**/out/**',
  '**/.next/**',

  // Cache directories
  '**/.cache/**',
  '**/.turbo/**',
  '**/.eslintcache',

  // Version control
  '**/.git/**',
  '**/.svn/**',
  '**/.hg/**',
  '**/public/**',

  // Type files
  '**/*.d.ts',
];

const gitignorePath = path.resolve(process.cwd(), '.gitignore');

/**
 * Ignore configuration: the package's `.gitignore` (when present, resolved
 * from the directory ESLint runs in) plus the defaults above.
 */
export const ignores: Linter.Config[] = [
  ...(existsSync(gitignorePath) ? [includeIgnoreFile(gitignorePath)] : []),
  {
    name: 'ignores/defaults',
    ignores: DEFAULT_IGNORES,
  },
];
