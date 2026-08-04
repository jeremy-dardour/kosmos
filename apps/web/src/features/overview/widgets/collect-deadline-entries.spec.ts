import { describe, expect, it } from 'vitest';

import {
  collectDeadlineEntries,
  groupEntriesByDate,
} from '@/features/overview/widgets/collect-deadline-entries';
import { deadlineEntry } from '@/testing/deadline-entries';

import type { Step, Workstream } from '@/api/hooks/use-overview';

const TIMESTAMP = '2026-01-01T00:00:00.000Z';

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

describe('collectDeadlineEntries', () => {
  it('keeps only pending steps that carry a deadline', () => {
    const workstreams = [
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({ id: 'done', status: 'done', deadline: '2026-01-10' }),
          makeStep({
            id: 'skipped',
            status: 'skipped',
            deadline: '2026-01-11',
          }),
          makeStep({
            id: 'current',
            status: 'in_progress',
            deadline: '2026-01-12',
          }),
          makeStep({
            id: 'upcoming',
            status: 'not_started',
            deadline: '2026-01-13',
          }),
          makeStep({ id: 'undated', status: 'not_started' }),
          makeStep({ id: 'null-deadline', deadline: null }),
        ],
      }),
    ];

    expect(collectDeadlineEntries(workstreams).map((e) => e.stepId)).toEqual([
      'current',
      'upcoming',
    ]);
  });

  it('excludes every step of a complete workstream', () => {
    const workstreams = [
      makeWorkstream({
        id: 'catering',
        lifecycle: 'complete',
        steps: [
          makeStep({
            id: 'leftover',
            status: 'not_started',
            deadline: '2026-01-05',
          }),
        ],
      }),
      makeWorkstream({
        id: 'flowers',
        lifecycle: 'not_started',
        steps: [
          makeStep({
            id: 'queued',
            status: 'not_started',
            deadline: '2026-01-06',
          }),
        ],
      }),
    ];

    expect(collectDeadlineEntries(workstreams).map((e) => e.stepId)).toEqual([
      'queued',
    ]);
  });

  it('sorts entries across workstreams by deadline ascending', () => {
    const workstreams = [
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({
            id: 'late',
            status: 'not_started',
            deadline: '2026-03-01',
          }),
          makeStep({
            id: 'early',
            status: 'in_progress',
            deadline: '2026-01-02',
          }),
        ],
      }),
      makeWorkstream({
        id: 'catering',
        steps: [
          makeStep({
            id: 'middle',
            status: 'not_started',
            deadline: '2026-02-09',
          }),
        ],
      }),
    ];

    expect(collectDeadlineEntries(workstreams).map((e) => e.stepId)).toEqual([
      'early',
      'middle',
      'late',
    ]);
  });

  it('carries the workstream identity onto each entry', () => {
    const workstreams = [
      makeWorkstream({
        id: 'venue',
        name: 'Venue',
        icon: '🏰',
        steps: [
          makeStep({
            id: 'visit',
            name: 'Visit venues',
            status: 'in_progress',
            deadline: '2026-01-20',
          }),
        ],
      }),
    ];

    expect(collectDeadlineEntries(workstreams)).toEqual([
      {
        workstreamId: 'venue',
        workstreamName: 'Venue',
        workstreamIcon: '🏰',
        stepId: 'visit',
        stepName: 'Visit venues',
        deadline: '2026-01-20',
        blocked: false,
      },
    ]);
  });

  it('marks a blocked current step but not a blocked step the pointer passed', () => {
    const workstreams = [
      makeWorkstream({
        id: 'venue',
        steps: [
          makeStep({
            id: 'stuck',
            status: 'in_progress',
            blocked: true,
            deadline: '2026-01-20',
          }),
          makeStep({
            id: 'ahead',
            status: 'not_started',
            blocked: true,
            deadline: '2026-01-21',
          }),
        ],
      }),
      makeWorkstream({
        id: 'catering',
        steps: [
          makeStep({
            id: 'advanced-past',
            status: 'done',
            blocked: true,
            deadline: '2026-01-22',
          }),
        ],
      }),
    ];

    expect(
      collectDeadlineEntries(workstreams).map((e) => [e.stepId, e.blocked]),
    ).toEqual([
      ['stuck', true],
      ['ahead', false],
    ]);
  });

  it('returns an empty list when nothing is pending', () => {
    expect(collectDeadlineEntries([])).toEqual([]);
  });
});

describe('groupEntriesByDate', () => {
  it('keys the days in the order they arrive and keeps same-day entries together', () => {
    const byDate = groupEntriesByDate([
      deadlineEntry('2026-01-10', { stepId: 'a' }),
      deadlineEntry('2026-01-10', { stepId: 'b' }),
      deadlineEntry('2026-02-01', { stepId: 'c' }),
    ]);

    expect(byDate.keys().toArray()).toEqual(['2026-01-10', '2026-02-01']);
    expect(byDate.get('2026-01-10')?.map((entry) => entry.stepId)).toEqual([
      'a',
      'b',
    ]);
    expect(byDate.get('2026-02-01')?.map((entry) => entry.stepId)).toEqual([
      'c',
    ]);
  });

  it('returns an empty map for an empty list', () => {
    expect(groupEntriesByDate([]).size).toBe(0);
  });
});
