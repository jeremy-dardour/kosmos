import { describe, expect, it } from 'vitest';

import { collectDeadlineEntries } from '@/features/overview/widgets/collect-deadline-entries';
import { derivePulseStats } from '@/features/overview/widgets/project-pulse-stats';

import type { Step, Workstream } from '@/api/hooks/use-overview';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';
const NOW = new Date(2026, 6, 25, 14, 30); // 2026-07-25, mid-afternoon

function makeStep(overrides: Partial<Step> & Pick<Step, 'id'>): Step {
  return {
    name: `Step ${overrides.id}`,
    position: 1,
    status: 'not_started',
    blocked: false,
    checklistItems: [],
    noteCount: 0,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function makeWorkstream(
  overrides: Partial<Workstream> & Pick<Workstream, 'id'>,
): Workstream {
  return {
    position: 0,
    name: `Workstream ${overrides.id}`,
    icon: '📋',
    lifecycle: 'active',
    steps: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    ...overrides,
  };
}

function statsOf(workstreams: Workstream[], now: Date = NOW) {
  return derivePulseStats(
    workstreams,
    collectDeadlineEntries(workstreams),
    now,
  );
}

describe('derivePulseStats', () => {
  it('counts workstreams by lifecycle', () => {
    const stats = statsOf([
      makeWorkstream({ id: 'a', lifecycle: 'active' }),
      makeWorkstream({ id: 'b', lifecycle: 'active' }),
      makeWorkstream({ id: 'c', lifecycle: 'not_started' }),
      makeWorkstream({ id: 'd', lifecycle: 'complete' }),
    ]);

    expect(stats).toMatchObject({ total: 4, active: 2, queued: 1, done: 1 });
  });

  it('rounds progress over every step in the list', () => {
    const stats = statsOf([
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({ id: '1', status: 'done' }),
          makeStep({ id: '2', status: 'skipped' }),
          makeStep({ id: '3', status: 'in_progress' }),
        ],
      }),
      makeWorkstream({
        id: 'catering',
        steps: [
          makeStep({ id: '4', status: 'not_started' }),
          makeStep({ id: '5', status: 'not_started' }),
          makeStep({ id: '6', status: 'not_started' }),
        ],
      }),
    ]);

    expect(stats).toMatchObject({
      settledSteps: 2,
      totalSteps: 6,
      progressPct: 33,
    });
  });

  it('rounds a two-thirds ratio up', () => {
    const stats = statsOf([
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({ id: '1', status: 'done' }),
          makeStep({ id: '2', status: 'done' }),
          makeStep({ id: '3', status: 'not_started' }),
        ],
      }),
    ]);

    expect(stats.progressPct).toBe(67);
  });

  it('reports zero progress when there are no steps at all', () => {
    const stats = statsOf([makeWorkstream({ id: 'venue' })]);

    expect(stats).toMatchObject({
      settledSteps: 0,
      totalSteps: 0,
      progressPct: 0,
    });
  });

  it('counts a workstream once however many of its steps are blocked', () => {
    const stats = statsOf([
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({ id: '1', status: 'in_progress', blocked: true }),
          makeStep({ id: '2', status: 'not_started', blocked: true }),
        ],
      }),
      makeWorkstream({
        id: 'catering',
        steps: [makeStep({ id: '3', status: 'done', blocked: true })],
      }),
    ]);

    expect(stats.blockedWorkstreams).toBe(1);
  });

  it('treats a deadline due today as pending and yesterday as overdue', () => {
    const stats = statsOf([
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({
            id: 'yesterday',
            status: 'in_progress',
            deadline: '2026-07-24',
          }),
          makeStep({
            id: 'today',
            status: 'not_started',
            deadline: '2026-07-25',
          }),
          makeStep({
            id: 'tomorrow',
            status: 'not_started',
            deadline: '2026-07-26',
          }),
        ],
      }),
    ]);

    expect(stats.overdueCount).toBe(1);
    expect(stats.nextEntry?.stepId).toBe('today');
  });

  it('has no next entry when every pending deadline has passed', () => {
    const stats = statsOf([
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({
            id: 'late',
            status: 'in_progress',
            deadline: '2026-07-01',
          }),
        ],
      }),
    ]);

    expect(stats.overdueCount).toBe(1);
    expect(stats.nextEntry).toBeNull();
  });

  it('has no next entry when nothing is pending', () => {
    expect(statsOf([]).nextEntry).toBeNull();
  });
});
