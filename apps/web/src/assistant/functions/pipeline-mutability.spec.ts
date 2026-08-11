import { describe, expect, it } from 'vitest';

import {
  editableFrom,
  resolveInsertionPosition,
} from '@/assistant/functions/pipeline-mutability';
import { step, workstream } from '@/testing/mock-overview-data';

const steps = [
  step('Shortlist places', 'done', { id: 's1', position: 1 }),
  step('Book a tasting', 'in_progress', { id: 's2', position: 2 }),
  step('Sign the contract', 'not_started', { id: 's3', position: 3 }),
];

const notStarted = workstream({
  lifecycle: 'not_started',
  currentStepId: null,
  steps: steps.map((entry) => ({ ...entry, status: 'not_started' as const })),
});

const active = workstream({
  lifecycle: 'active',
  currentStepId: 's2',
  steps,
});

const complete = workstream({
  lifecycle: 'complete',
  currentStepId: null,
  steps: steps.map((entry) => ({ ...entry, status: 'done' as const })),
});

describe('editableFrom', () => {
  it('is the first position while the workstream has not started', () => {
    expect(editableFrom(notStarted)).toBe(1);
  });

  it('is one past the current step while the workstream is active', () => {
    expect(editableFrom(active)).toBe(3);
  });

  it('is nothing once the workstream is complete', () => {
    expect(editableFrom(complete)).toBeNull();
  });

  it('is the first position for an active workstream with no steps yet', () => {
    expect(editableFrom(workstream({ currentStepId: null, steps: [] }))).toBe(
      1,
    );
  });
});

describe('resolveInsertionPosition', () => {
  it('appends after the last step for "end"', () => {
    expect(resolveInsertionPosition(active, 'end')).toEqual({
      ok: true,
      position: 4,
    });
  });

  it('inserts directly behind the anchor step', () => {
    expect(resolveInsertionPosition(active, 's2')).toEqual({
      ok: true,
      position: 3,
    });
  });

  it('accepts any anchor while the workstream has not started', () => {
    expect(resolveInsertionPosition(notStarted, 's1')).toEqual({
      ok: true,
      position: 2,
    });
  });

  it('refuses to insert behind a past step', () => {
    const result = resolveInsertionPosition(active, 's1');

    if (result.ok) throw new Error('expected the insertion to be refused');
    expect(result.error).toContain('already past');
  });

  it('refuses a complete workstream entirely', () => {
    const result = resolveInsertionPosition(complete, 'end');

    if (result.ok) throw new Error('expected the insertion to be refused');
    expect(result.error).toContain('is complete');
  });

  it('reports an anchor that is not in the workstream', () => {
    const result = resolveInsertionPosition(active, 'unknown-step');

    if (result.ok) throw new Error('expected the insertion to be refused');
    expect(result.error).toContain('No step with id');
  });
});
