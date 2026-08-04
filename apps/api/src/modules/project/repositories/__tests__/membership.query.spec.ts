import { describe, expect, it } from 'vitest';

import { projectVisibleTo } from '@/modules/project/repositories/membership.query';

describe('projectVisibleTo', () => {
  it('fails fast when the user id is missing', () => {
    expect(() => projectVisibleTo('')).toThrow('requires a user id');
  });
});
