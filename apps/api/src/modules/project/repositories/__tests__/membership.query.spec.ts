import { describe, expect, it } from 'vitest';

import { memberProject } from '@/modules/project/repositories/membership.query';

describe('memberProject', () => {
  it('fails fast when the actor id is missing', () => {
    expect(() => memberProject('')).toThrow('requires an actor id');
  });
});
