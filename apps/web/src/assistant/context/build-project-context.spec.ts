import { describe, expect, it } from 'vitest';

import { buildProjectContext } from '@/assistant/context/build-project-context';
import { group, project } from '@/testing/mock-overview-data';

import type { Member } from '@/api/hooks/use-project-members';
import type { ProjectContextInput } from '@/assistant/context/build-project-context';

const TODAY = new Date(2026, 7, 11); // 2026-08-11, local time

const member = (overrides: Partial<Member> = {}): Member => ({
  id: 'm1',
  email: 'alice@example.com',
  userId: 'u1',
  name: 'Alice',
  avatarUrl: null,
  isOwner: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  ...overrides,
});

const build = (overrides: Partial<ProjectContextInput> = {}) =>
  buildProjectContext({
    project: project({ eventDate: '2026-09-12' }),
    members: [member()],
    groups: [group()],
    today: TODAY,
    currentUserId: undefined,
    ...overrides,
  }).data!;

describe('buildProjectContext', () => {
  it('carries today and the countdown alongside the event date', () => {
    expect(build()).toMatchObject({
      id: 'p1',
      name: 'Our Wedding',
      today: '2026-08-11',
      eventDate: '2026-09-12',
      daysUntilEvent: 32,
    });
  });

  it('says "no event date" and omits the countdown when there is none', () => {
    const data = build({ project: project({ eventDate: null }) });

    expect(data.eventDate).toBe('no event date');
    expect(data).not.toHaveProperty('daysUntilEvent');
  });

  it('renders member lines led by the user id, marking the owner', () => {
    const data = build({
      members: [
        member(),
        member({
          id: 'm2',
          userId: 'u2',
          email: 'bob@example.com',
          name: 'Bob',
          isOwner: false,
        }),
      ],
    });

    expect(String(data.members).split('\n')).toEqual([
      'u1 Alice (owner)',
      'u2 Bob',
    ]);
  });

  it('marks the signed-in user, combining with the owner mark', () => {
    const data = build({
      members: [
        member(),
        member({
          id: 'm2',
          userId: 'u2',
          email: 'bob@example.com',
          name: 'Bob',
          isOwner: false,
        }),
      ],
      currentUserId: 'u2',
    });

    expect(String(data.members).split('\n')).toEqual([
      'u1 Alice (owner)',
      'u2 Bob (you)',
    ]);

    expect(String(build({ currentUserId: 'u1' }).members)).toBe(
      'u1 Alice (owner, you)',
    );
  });

  it('falls back to the email when a member has no name', () => {
    const data = build({ members: [member({ name: null, isOwner: false })] });

    expect(data.members).toBe('u1 alice@example.com');
  });

  it('excludes members who have not signed in yet', () => {
    const data = build({
      members: [member(), member({ id: 'm2', userId: null, name: null })],
    });

    expect(data.members).toBe('u1 Alice (owner)');
  });

  it('renders group lines led by the group id', () => {
    const data = build({
      groups: [group(), group({ id: 'g2', name: 'Logistics', position: 1 })],
    });

    expect(String(data.groups).split('\n')).toEqual([
      'g1 Venue & Catering',
      'g2 Logistics',
    ]);
  });

  it('reports empty lists rather than empty strings', () => {
    const data = build({ members: [], groups: [] });

    expect(data.members).toBe('no members');
    expect(data.groups).toBe('no groups');
  });

  it('treats a missing members query as no members', () => {
    expect(build({ members: undefined }).members).toBe('no members');
  });
});
