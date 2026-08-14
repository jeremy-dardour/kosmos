import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchOverview } from '@/api/hooks/use-overview';
import { getWorkstreamFunction } from '@/assistant/functions/get-workstream';
import {
  checklistItem,
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';

import type { Overview } from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@/api/hooks/use-overview', () => ({
  fetchOverview: vi.fn(),
  refreshOverview: vi.fn(),
}));

const queryClient = {} as QueryClient;

const overview: Overview = {
  project: project(),
  groups: [group()],
  users: [user({ id: 'u1', name: 'Alice Doe' })],
  workstreams: [
    workstream({
      id: 'w1',
      groupId: 'g1',
      ownerId: 'u1',
      lifecycle: 'active',
      currentStepId: 's2',
      steps: [
        step('Shortlist places', 'done', { id: 's1', position: 1 }),
        step('Book a tasting', 'in_progress', {
          id: 's2',
          position: 2,
          deadline: '2026-09-12',
          effectiveOwnerId: 'u1',
          blocked: true,
          noteCount: 3,
          checklistItems: [
            checklistItem('Chateau A', true, { id: 'c1' }),
            checklistItem('Chateau B', false, { id: 'c2', position: 2 }),
          ],
        }),
        step('Sign the contract', 'not_started', { id: 's3', position: 3 }),
      ],
    }),
  ],
};

const call = (workstreamId: unknown) =>
  getWorkstreamFunction(queryClient, 'p1').handler({ workstreamId });

describe('getWorkstream', () => {
  beforeEach(() => {
    vi.mocked(fetchOverview).mockResolvedValue(overview);
  });

  it('projects the workstream with its group, owner and editable zone', async () => {
    expect(await call('w1')).toMatchObject({
      workstreamId: 'w1',
      name: 'Catering',
      lifecycle: 'Active',
      group: 'Venue & Catering',
      ownerName: 'Alice Doe',
      currentStepId: 's2',
      editableFrom: 3,
    });
  });

  it('projects each step with its status, deadline, owner and checklist', async () => {
    const detail = (await call('w1')) as { steps: unknown[] };

    expect(detail.steps[1]).toEqual({
      stepId: 's2',
      position: 2,
      name: 'Book a tasting',
      status: 'InProgress',
      deadline: '2026-09-12',
      ownerName: 'Alice Doe',
      blocked: true,
      noteCount: 3,
      checklist: [
        { id: 'c1', name: 'Chateau A', done: true },
        { id: 'c2', name: 'Chateau B', done: false },
      ],
    });
  });

  it('reports note counts without ever carrying note bodies', async () => {
    const serialized = JSON.stringify(await call('w1'));

    expect(serialized).toContain('"noteCount":3');
    expect(serialized).not.toContain('content');
  });

  it('returns a clear error for an unknown workstream id', async () => {
    const result = (await call('nope')) as { error?: string };

    expect(result.error).toContain('No workstream with id "nope"');
  });
});
