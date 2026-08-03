import { isExactMembership } from '@/modules/project/utils/order-membership.util';

describe('isExactMembership', () => {
  it('accepts a permutation of the members', () => {
    expect(isExactMembership(['c', 'a', 'b'], ['a', 'b', 'c'])).toBe(true);
  });

  it('accepts two empty lists', () => {
    expect(isExactMembership([], [])).toBe(true);
  });

  it('rejects a missing member', () => {
    expect(isExactMembership(['a'], ['a', 'b'])).toBe(false);
  });

  it('rejects an id that is not a member', () => {
    expect(isExactMembership(['a', 'z'], ['a', 'b'])).toBe(false);
  });

  it('rejects a duplicated id', () => {
    expect(isExactMembership(['a', 'a'], ['a', 'b'])).toBe(false);
  });
});
