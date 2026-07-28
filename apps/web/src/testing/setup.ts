import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/testing/mock-api';

vi.mock('@/config/env', () => ({
  env: {
    apiUrl: 'http://localhost:3000',
    dev: true,
    fakeAuth: true,
  },
}));

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
