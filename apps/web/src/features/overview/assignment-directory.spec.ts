import { describe, expect, it } from 'vitest';

import {
  buildUsersById,
  toAssignableUsers,
} from '@/features/overview/assignment-directory';

import type { Member } from '@/api/hooks/use-project-members';

const member = (overrides: Partial<Member>): Member => ({
  id: 'row-1',
  email: 'someone@example.com',
  userId: 'u1',
  name: 'Someone',
  avatarUrl: null,
  isOwner: false,
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('buildUsersById', () => {
  it('flags a referenced user missing from the members list as an ex-member', () => {
    const users = [
      { id: 'u1', name: 'Still Here' },
      { id: 'u2', name: 'Gone Now' },
    ];

    const byId = buildUsersById(users, [member({ userId: 'u1' })]);

    expect(byId.get('u1')?.isMember).toBe(true);
    expect(byId.get('u2')?.isMember).toBe(false);
  });

  it('treats everyone as a member while the members query has no data', () => {
    const byId = buildUsersById([{ id: 'u1', name: 'Anyone' }], undefined);

    expect(byId.get('u1')?.isMember).toBe(true);
  });
});

describe('toAssignableUsers', () => {
  it('keeps joined members only, sorted by name', () => {
    const users = toAssignableUsers([
      member({ id: 'r1', userId: 'u2', name: 'Zoé' }),
      member({ id: 'r2', userId: null, name: null, email: 'pending@x.io' }),
      member({ id: 'r3', userId: 'u1', name: 'Ada' }),
    ]);

    expect(users).toEqual([
      { id: 'u1', name: 'Ada', avatarUrl: null },
      { id: 'u2', name: 'Zoé', avatarUrl: null },
    ]);
  });
});
