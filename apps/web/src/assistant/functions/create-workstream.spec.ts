import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { createStep } from '@/api/hooks/use-create-step';
import { createWorkstream } from '@/api/hooks/use-create-workstream';
import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { createWorkstreamFunction } from '@/assistant/functions/create-workstream';
import { project, step, workstream } from '@/testing/mock-overview-data';

import type { Overview } from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@/api/hooks/use-overview', () => ({
  fetchOverview: vi.fn(),
  refreshOverview: vi.fn(),
}));
vi.mock('@/api/hooks/use-create-workstream', () => ({
  createWorkstream: vi.fn(),
}));
vi.mock('@/api/hooks/use-create-step', () => ({ createStep: vi.fn() }));
vi.mock('@/api/hooks/use-create-checklist-item', () => ({
  createChecklistItem: vi.fn(),
}));

const queryClient = {} as QueryClient;

const overviewWith = (eventDate: string | null): Overview => ({
  project: project({ eventDate }),
  groups: [],
  users: [],
  workstreams: [],
});

const insertedAt = (name: string, position: number) =>
  workstream({
    steps: [step(name, 'not_started', { id: `s${position}`, position })],
  });

const namedSteps = (...names: string[]) => names.map((name) => ({ name }));

const call = (arguments_: Record<string, unknown>) =>
  createWorkstreamFunction(queryClient, 'p1').handler(arguments_) as Promise<
    Record<string, unknown>
  >;

const positionsCreated = () =>
  vi.mocked(createStep).mock.calls.map(([, input]) => input.position);

describe('createWorkstream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOverview).mockResolvedValue(overviewWith('2026-10-03'));
    vi.mocked(createWorkstream).mockResolvedValue(workstream({ id: 'w9' }));
    vi.mocked(createStep).mockImplementation((_id, input) =>
      Promise.resolve(insertedAt(input.name, input.position)),
    );
    vi.mocked(createChecklistItem).mockResolvedValue({
      id: 'c1',
      name: 'item',
      position: 1,
      done: false,
      createdAt: '',
      updatedAt: '',
    });
  });

  it('creates the steps at contiguous 1-indexed positions, in order', async () => {
    await call({
      name: 'Catering',
      icon: '🍽️',
      steps: namedSteps('Shortlist', 'Taste', 'Sign', 'Confirm'),
    });

    expect(positionsCreated()).toEqual([1, 2, 3, 4]);
    expect(
      vi.mocked(createStep).mock.calls.map(([, input]) => input.name),
    ).toEqual(['Shortlist', 'Taste', 'Sign', 'Confirm']);
  });

  it('reports the new workstream and its step ids on success', async () => {
    const result = await call({
      name: 'Catering',
      icon: '🍽️',
      steps: [{ name: 'Shortlist', checklist: ['Chateau A'] }],
    });

    expect(result).toMatchObject({
      success: true,
      workstreamId: 'w9',
      created: [
        {
          stepId: 's1',
          name: 'Shortlist',
          position: 1,
          checklistItems: ['Chateau A'],
        },
      ],
    });
  });

  it('resolves {daysBeforeEvent} against the project event date before writing', async () => {
    await call({
      name: 'Catering',
      icon: '🍽️',
      steps: [{ name: 'Sign', deadline: { daysBeforeEvent: 30 } }],
    });

    expect(vi.mocked(createStep).mock.calls[0]?.[1]).toMatchObject({
      deadline: '2026-09-03',
    });
  });

  it('refuses {daysBeforeEvent} without an event date and writes nothing', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(overviewWith(null));

    const result = await call({
      name: 'Catering',
      icon: '🍽️',
      steps: [{ name: 'Sign', deadline: { daysBeforeEvent: 30 } }],
    });

    expect(result).toMatchObject({ success: false, workstreamCreated: false });
    expect(String(result.error)).toContain('no event date');
    expect(createWorkstream).not.toHaveBeenCalled();
    expect(createStep).not.toHaveBeenCalled();
  });

  it('refuses a workstream without an icon and writes nothing', async () => {
    const result = await call({ name: 'Catering', steps: namedSteps('Sign') });

    expect(result).toMatchObject({ success: false });
    expect(createWorkstream).not.toHaveBeenCalled();
  });

  it('reports created, failed and never-attempted steps when step 3 of 5 fails', async () => {
    vi.mocked(createStep)
      .mockResolvedValueOnce(insertedAt('One', 1))
      .mockResolvedValueOnce(insertedAt('Two', 2))
      .mockRejectedValueOnce({ detail: 'Deadline is before the event date' });

    const result = await call({
      name: 'Catering',
      icon: '🍽️',
      steps: namedSteps('One', 'Two', 'Three', 'Four', 'Five'),
    });

    expect(result).toMatchObject({
      success: false,
      workstreamCreated: true,
      workstreamId: 'w9',
      failed: {
        step: 'Three',
        reason: 'Deadline is before the event date',
      },
      notAttempted: { steps: ['Four', 'Five'], checklistItems: [] },
    });
    expect(result.created).toMatchObject([
      { stepId: 's1', name: 'One', position: 1 },
      { stepId: 's2', name: 'Two', position: 2 },
    ]);
  });

  it('reports the checklist items created, failed and never attempted', async () => {
    vi.mocked(createChecklistItem)
      .mockResolvedValueOnce({
        id: 'c1',
        name: 'Chateau A',
        position: 1,
        done: false,
        createdAt: '',
        updatedAt: '',
      })
      .mockRejectedValueOnce({ detail: 'Name is too long' });

    const result = await call({
      name: 'Catering',
      icon: '🍽️',
      steps: [
        {
          name: 'Shortlist',
          checklist: ['Chateau A', 'Chateau B', 'Chateau C'],
        },
        { name: 'Taste' },
      ],
    });

    expect(result).toMatchObject({
      success: false,
      failed: {
        step: 'Shortlist',
        checklistItem: 'Chateau B',
        reason: 'Name is too long',
      },
      notAttempted: { steps: ['Taste'], checklistItems: ['Chateau C'] },
    });
    expect(result.created).toMatchObject([
      { name: 'Shortlist', checklistItems: ['Chateau A'] },
    ]);
  });

  it('lists every step as never attempted when the workstream itself fails', async () => {
    vi.mocked(createWorkstream).mockRejectedValueOnce({
      detail: 'Icon is required',
    });

    const result = await call({
      name: 'Catering',
      icon: '🍽️',
      steps: namedSteps('One', 'Two'),
    });

    expect(result).toMatchObject({
      success: false,
      workstreamCreated: false,
      error: 'Icon is required',
      notAttempted: { steps: ['One', 'Two'] },
    });
  });

  it('awaits the overview refresh on the success and the partial-failure path', async () => {
    await call({ name: 'Catering', icon: '🍽️', steps: namedSteps('One') });
    expect(refreshOverview).toHaveBeenCalledWith(queryClient, 'p1');

    vi.mocked(refreshOverview).mockClear();
    vi.mocked(createStep).mockRejectedValueOnce({ detail: 'nope' });
    await call({ name: 'Catering', icon: '🍽️', steps: namedSteps('One') });
    expect(refreshOverview).toHaveBeenCalledWith(queryClient, 'p1');
  });
});
