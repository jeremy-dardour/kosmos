import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { updateStep } from '@/api/hooks/use-update-step';
import { updateStepFunction } from '@/assistant/functions/update-step';
import { project, step, workstream } from '@/testing/mock-overview-data';

import type { ChecklistItem, Overview } from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@/api/hooks/use-overview', () => ({
  fetchOverview: vi.fn(),
  refreshOverview: vi.fn(),
}));
vi.mock('@/api/hooks/use-update-step', () => ({ updateStep: vi.fn() }));
vi.mock('@/api/hooks/use-create-checklist-item', () => ({
  createChecklistItem: vi.fn(),
}));

const queryClient = {} as QueryClient;

const past = step('Shortlist places', 'done', { id: 's1', position: 1 });
const current = step('Book a tasting', 'in_progress', {
  id: 's2',
  position: 2,
});
const future = step('Sign the contract', 'not_started', {
  id: 's3',
  position: 3,
});

const overview: Overview = {
  project: project({ eventDate: '2026-10-03' }),
  groups: [],
  users: [],
  workstreams: [
    workstream({
      id: 'w1',
      lifecycle: 'active',
      currentStepId: 's2',
      steps: [past, current, future],
    }),
  ],
};

const createdItem = (name: string): ChecklistItem => ({
  id: `c-${name}`,
  name,
  position: 1,
  done: false,
  createdAt: '',
  updatedAt: '',
});

const call = (arguments_: Record<string, unknown>) =>
  updateStepFunction(queryClient, 'p1').handler(arguments_) as Promise<
    Record<string, unknown>
  >;

describe('updateStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOverview).mockResolvedValue(overview);
    vi.mocked(updateStep).mockResolvedValue(current);
    vi.mocked(createChecklistItem).mockImplementation((_stepId, input) =>
      Promise.resolve(createdItem(input.name)),
    );
  });

  it('edits the current step and refreshes the overview', async () => {
    const result = await call({ stepId: 's2', name: 'Book the tasting' });

    expect(updateStep).toHaveBeenCalledWith('s2', { name: 'Book the tasting' });
    expect(result).toMatchObject({ success: true, updated: ['name'] });
    expect(refreshOverview).toHaveBeenCalledWith(queryClient, 'p1');
  });

  it('edits a future step', async () => {
    vi.mocked(updateStep).mockResolvedValue(future);

    expect(await call({ stepId: 's3', blocked: true })).toMatchObject({
      success: true,
    });
  });

  it('refuses a past step and writes nothing', async () => {
    const result = await call({ stepId: 's1', name: 'Shortlist venues' });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('frozen');
    expect(updateStep).not.toHaveBeenCalled();
  });

  it('notes that a blocked flag has no effect off the current step', async () => {
    vi.mocked(updateStep).mockResolvedValue(future);

    const result = await call({ stepId: 's3', blocked: true });

    expect(result.note).toContain('not the step in progress');
  });

  it('resolves {daysBeforeEvent} against the project event date', async () => {
    await call({ stepId: 's2', deadline: { daysBeforeEvent: 30 } });

    expect(updateStep).toHaveBeenCalledWith('s2', { deadline: '2026-09-03' });
  });

  it('refuses {daysBeforeEvent} without an event date and writes nothing', async () => {
    vi.mocked(fetchOverview).mockResolvedValue({
      ...overview,
      project: project({ eventDate: null }),
    });

    const result = await call({
      stepId: 's2',
      deadline: { daysBeforeEvent: 30 },
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('no event date');
    expect(updateStep).not.toHaveBeenCalled();
  });

  it('clears the deadline when passed null', async () => {
    await call({ stepId: 's2', deadline: null });

    expect(updateStep).toHaveBeenCalledWith('s2', { deadline: null });
  });

  it('reports the checklist items created, failed and never attempted', async () => {
    vi.mocked(createChecklistItem)
      .mockResolvedValueOnce(createdItem('Chateau A'))
      .mockRejectedValueOnce({ detail: 'Name is too long' });

    const result = await call({
      stepId: 's2',
      addChecklistItems: ['Chateau A', 'Chateau B', 'Chateau C'],
    });

    expect(result).toMatchObject({
      success: false,
      stepUpdated: true,
      checklistItemsCreated: ['Chateau A'],
      failed: { checklistItem: 'Chateau B', reason: 'Name is too long' },
      notAttempted: { checklistItems: ['Chateau C'] },
    });
    expect(refreshOverview).toHaveBeenCalledWith(queryClient, 'p1');
  });

  it('refuses a call that changes nothing', async () => {
    const result = await call({ stepId: 's2' });

    expect(result).toMatchObject({ success: false });
    expect(updateStep).not.toHaveBeenCalled();
  });

  it('reports an unknown step id', async () => {
    const result = await call({ stepId: 'nope' });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('No step with id "nope"');
  });
});
