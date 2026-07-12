import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

import {
  VITEST_COVERAGE_PROVIDER,
  VITEST_EXCLUDE_CONFIG,
} from './vitest.constant.js';

export default defineConfig({
  oxc: false,
  test: {
    globals: true,
    environment: 'node',
    root: './',
    include: ['src/__e2e-tests__/**/*.e2e-spec.ts'],
    setupFiles: ['./src/__e2e-tests__/setup.ts'],
    fileParallelism: false,
    coverage: {
      provider: VITEST_COVERAGE_PROVIDER,
      reporter: ['json'],
      reportsDirectory: './coverage/e2e',
      include: ['src/**/*.ts'],
      exclude: VITEST_EXCLUDE_CONFIG,
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
          dynamicImport: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'esnext',
        keepClassNames: true,
      },
      module: {
        type: 'es6',
      },
    }),
    tsconfigPaths(),
  ],
});
