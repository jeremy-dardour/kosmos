/**
 * E2E test global setup file
 * Runs before all tests
 */

import { config } from 'dotenv';
import { afterAll, beforeAll } from 'vitest';

// Load .env.e2e environment variables, then an untracked local override
// (e.g. a per-workspace DATABASE_URL port — see
// scripts/setup_parallel_workspace.sh) if present.
config({ path: '.env.e2e' });
config({ path: '.env.e2e.local', override: true });

// Set test timeout
beforeAll(() => {
  // E2E tests may need longer timeout
  // Currently using defaults
});

// Global cleanup
afterAll(() => {
  // Cleanup after all tests complete
});
