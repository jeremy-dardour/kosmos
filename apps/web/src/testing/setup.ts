import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('@/config/env', () => ({
  env: {
    apiUrl: 'http://localhost:3000',
    dev: true,
    fakeAuth: true,
  },
}));
