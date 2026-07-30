import { describe, expect, it } from 'vitest';

import { groupWorkstreams } from '@/features/overview/group-workstreams';

import type { Group, Workstream } from '@/api/hooks/use-overview';

function group(id: string, name: string): Group {
  return {
    id,
    name,
    color: '#5a9e6f',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function workstream(id: string, groupId: string | null): Workstream {
  return {
    id,
    name: id,
    icon: '💐',
    groupId,
    lifecycle: 'not_started',
    ownerId: null,
    steps: [],
    nearestDeadlineStepId: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('groupWorkstreams', () => {
  it('clusters workstreams under their group, keeping group order', () => {
    const buckets = groupWorkstreams(
      [group('g1', 'Logistics'), group('g2', 'Vendors')],
      [workstream('w1', 'g2'), workstream('w2', 'g1'), workstream('w3', 'g2')],
    );

    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.group?.id).toBe('g1');
    expect(buckets[0]?.workstreams.map((w) => w.id)).toEqual(['w2']);
    expect(buckets[1]?.workstreams.map((w) => w.id)).toEqual(['w1', 'w3']);
  });

  it('puts ungrouped workstreams in a trailing bucket', () => {
    const buckets = groupWorkstreams(
      [group('g1', 'Logistics')],
      [workstream('w1', null), workstream('w2', 'g1')],
    );

    expect(buckets).toHaveLength(2);
    expect(buckets[1]?.group).toBeNull();
    expect(buckets[1]?.workstreams.map((w) => w.id)).toEqual(['w1']);
  });

  it('leaves out groups that hold no workstreams', () => {
    const buckets = groupWorkstreams(
      [group('g1', 'Logistics'), group('g2', 'Vendors')],
      [workstream('w1', 'g2')],
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.group?.id).toBe('g2');
  });

  it('omits the ungrouped bucket when everything is grouped', () => {
    const buckets = groupWorkstreams(
      [group('g1', 'Logistics')],
      [workstream('w1', 'g1')],
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.group).not.toBeNull();
  });

  it('treats a workstream pointing at an unknown group as ungrouped', () => {
    const buckets = groupWorkstreams(
      [group('g1', 'Logistics')],
      [workstream('w1', 'missing')],
    );

    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.group).toBeNull();
  });

  it('returns nothing when there are no workstreams', () => {
    expect(groupWorkstreams([group('g1', 'Logistics')], [])).toEqual([]);
  });
});
