/// <reference types="vitest" />
import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setup.ts'],
    exclude: ['node_modules', 'e2e'],
    coverage: {
      provider: 'v8',
      // json-summary + json feed the CI coverage comment
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Entry points — not unit-testable
        'src/main.tsx',
        'src/bootstrap.ts',
        // Type declarations only
        'src/types/**',
        'src/**/*.d.ts',
        '**/*.type.ts',
        '**/*.interface.ts',
        // Test infrastructure
        'src/testing/**',
        'src/**/__tests__/**',
        // Runtime config / i18n setup — environment-dependent
        'src/config/**',
        'src/i18n/**',
        // Routing / shell — not unit-testable
        'src/app/router.tsx',
        // Barrel files
        '**/index.ts',
        '**/index.tsx',
      ],
    },
    testTimeout: 10_000,
  },
});
