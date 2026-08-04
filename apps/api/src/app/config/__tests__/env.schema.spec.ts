import { describe, expect, it } from 'vitest';

import { validateEnv } from '@/app/config/env.schema';

const FAKE_AUTH_ENV = {
  DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
  FAKE_AUTH: 'true',
};

describe('validateEnv', () => {
  it('accepts FAKE_AUTH=true with an explicit development NODE_ENV', () => {
    const env = validateEnv({ ...FAKE_AUTH_ENV, NODE_ENV: 'development' });

    expect(env.FAKE_AUTH).toBe(true);
  });

  it('rejects FAKE_AUTH=true when NODE_ENV is left to its default', () => {
    expect(() => validateEnv(FAKE_AUTH_ENV)).toThrow(
      /NODE_ENV to be explicitly set/,
    );
  });

  it('rejects FAKE_AUTH=true when NODE_ENV is production', () => {
    expect(() =>
      validateEnv({ ...FAKE_AUTH_ENV, NODE_ENV: 'production' }),
    ).toThrow(/NODE_ENV to be explicitly set/);
  });
});
