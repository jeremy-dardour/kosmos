/**
 * E2E test global setup file
 * Runs before all tests
 */

import { config } from 'dotenv';
import { afterAll, beforeAll } from 'vitest';

// Load .env.e2e environment variables
config({ path: '.env.e2e' });

// Set test timeout
beforeAll(() => {
  // E2E tests may need longer timeout
  // Currently using defaults
});

// Global cleanup
afterAll(() => {
  // Cleanup after all tests complete
});
