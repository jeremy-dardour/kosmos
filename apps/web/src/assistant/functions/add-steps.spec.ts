import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { createStep } from '@/api/hooks/use-create-step';
import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { addStepsFunction } from '@/assistant/functions/add-steps';
import { project, step, workstream } from '@/testing/mock-overview-data';

import type { Overview, Workstream } from '@/api/hooks/use-overview';
import type { QueryClient } from '@tanstack/react-query';

vi.mock('@/api/hooks/use-overview', () => ({
  fetchOverview: vi.fn(),
  refreshOverview: vi.fn(),
}));
vi.mock('@/api/hooks/use-create-step', () => ({ createStep: vi.fn() }));
vi.mock('@/api/hooks/use-create-checklist-item', () => ({
  createChecklistItem: vi.fn(),
}));

const queryClient = {} as QueryClient;

const active = workstream({
  id: 'w1',
  lifecycle: 'active',
  currentStepId: 's2',
  steps: [
    step('Shortlist places', 'done', { id: 's1', position: 1 }),
    step('Book a tasting', 'in_progress', { id: 's2', position: 2 }),
    step('Sign the contract', 'not_started', { id: 's3', position: 3 }),
  ],
});

const overviewOf = (target: Workstream): Overview => ({
  project: project({ eventDate: '2026-10-03' }),
  groups: [],
  users: [],
  workstreams: [target],
});

const insertedAt = (name: string, position: number) =>
  workstream({
    steps: [step(name, 'not_started', { id: `new-${position}`, position })],
  });

const call = (arguments_: Record<string, unknown>) =>
  addStepsFunction(queryClient, 'p1').handler(arguments_) as Promise<
    Record<string, unknown>
  >;

describe('addSteps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchOverview).mockResolvedValue(overviewOf(active));
    vi.mocked(createStep).mockImplementation((_id, input) =>
      Promise.resolve(insertedAt(input.name, input.position)),
    );
  });

  it('appends at the end of the pipeline, contiguously', async () => {
    const result = await call({
      workstreamId: 'w1',
      after: 'end',
      steps: [{ name: 'Confirm numbers' }, { name: 'Final walkthrough' }],
    });

    expect(
      vi.mocked(createStep).mock.calls.map(([, input]) => input.position),
    ).toEqual([4, 5]);
    expect(result).toMatchObject({ success: true, workstreamId: 'w1' });
  });

  it('inserts directly after the anchor step', async () => {
    await call({
      workstreamId: 'w1',
      after: 's2',
      steps: [{ name: 'Chase the quote' }],
    });

    expect(vi.mocked(createStep).mock.calls[0]?.[1]).toMatchObject({
      position: 3,
    });
  });

  it('refuses an anchor that is already past, without writing', async () => {
    const result = await call({
      workstreamId: 'w1',
      after: 's1',
      steps: [{ name: 'Chase the quote' }],
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('already past');
    expect(createStep).not.toHaveBeenCalled();
  });

  it('refuses a complete workstream, without writing', async () => {
    vi.mocked(fetchOverview).mockResolvedValue(
      overviewOf(
        workstream({ id: 'w1', lifecycle: 'complete', currentStepId: null }),
      ),
    );

    const result = await call({
      workstreamId: 'w1',
      after: 'end',
      steps: [{ name: 'One more thing' }],
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('is complete');
    expect(createStep).not.toHaveBeenCalled();
  });

  it('reports an unknown workstream id', async () => {
    const result = await call({
      workstreamId: 'nope',
      after: 'end',
      steps: [{ name: 'One' }],
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('No workstream with id "nope"');
  });

  it('reports what was added and what was not when a step fails midway', async () => {
    vi.mocked(createStep)
      .mockResolvedValueOnce(insertedAt('One', 4))
      .mockRejectedValueOnce({
        detail: 'Position 5 is not in the future zone',
      });

    const result = await call({
      workstreamId: 'w1',
      after: 'end',
      steps: [{ name: 'One' }, { name: 'Two' }, { name: 'Three' }],
    });

    expect(result).toMatchObject({
      success: false,
      failed: { step: 'Two', reason: 'Position 5 is not in the future zone' },
      notAttempted: { steps: ['Three'], checklistItems: [] },
    });
    expect(result.created).toMatchObject([
      { stepId: 'new-4', name: 'One', position: 4 },
    ]);
    expect(refreshOverview).toHaveBeenCalledWith(queryClient, 'p1');
  });

  it('refuses {daysBeforeEvent} without an event date and writes nothing', async () => {
    vi.mocked(fetchOverview).mockResolvedValue({
      ...overviewOf(active),
      project: project({ eventDate: null }),
    });

    const result = await call({
      workstreamId: 'w1',
      after: 'end',
      steps: [{ name: 'One', deadline: { daysBeforeEvent: 10 } }],
    });

    expect(result.success).toBe(false);
    expect(String(result.error)).toContain('no event date');
    expect(createStep).not.toHaveBeenCalled();
    expect(createChecklistItem).not.toHaveBeenCalled();
  });
});
