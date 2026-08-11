import { describe, expect, it } from 'vitest';

import { buildWorkstreamsContext } from '@/assistant/context/build-workstreams-context';
import {
  group,
  project,
  step,
  user,
  workstream,
} from '@/testing/mock-overview-data';

import type { Overview } from '@/api/hooks/use-overview';

const overview = (partial: Partial<Overview> = {}): Overview => ({
  project: project(),
  groups: [],
  workstreams: [],
  users: [],
  ...partial,
});

const lines = (partial: Partial<Overview> = {}): string[] =>
  String(buildWorkstreamsContext(overview(partial)).data?.workstreams).split(
    '\n',
  );

const activeCatering = workstream({
  currentStepId: 'step-Book tasting',
  ownerId: 'u1',
  groupId: 'g1',
  steps: [
    step('Shortlist caterers', 'done', {
      position: 1,
      effectiveOwnerId: 'u1',
    }),
    step('Request quotes', 'done', { position: 2, effectiveOwnerId: 'u1' }),
    step('Book tasting', 'in_progress', {
      position: 3,
      deadline: '2026-09-12',
      effectiveOwnerId: 'u2',
    }),
    step('Sign the caterer', 'not_started', { position: 4 }),
    step('Agree the menu', 'not_started', { position: 5 }),
    step('Confirm numbers', 'not_started', { position: 6 }),
    step('Confirm delivery', 'not_started', { position: 7 }),
  ],
});

describe('buildWorkstreamsContext', () => {
  it('renders an active workstream as one id-led line', () => {
    expect(
      lines({
        workstreams: [activeCatering],
        groups: [group({ id: 'g1', name: 'Vendors' })],
        users: [user({ id: 'u2', name: 'Bob' })],
      }),
    ).toEqual([
      'w1 Catering [Active] · 3/7 step-Book tasting "Book tasting" · due 2026-09-12 · owner Bob · group Vendors',
    ]);
  });

  it('flags a blocked current step and drops absent segments', () => {
    const blocked = workstream({
      currentStepId: 'step-Book tasting',
      steps: [
        step('Book tasting', 'in_progress', { position: 1, blocked: true }),
      ],
    });

    expect(lines({ workstreams: [blocked] })).toEqual([
      'w1 Catering [Active] · 1/1 step-Book tasting "Book tasting" · blocked',
    ]);
  });

  it('renders a not-started workstream as a step count with its default owner', () => {
    const notStarted = workstream({
      lifecycle: 'not_started',
      currentStepId: null,
      ownerId: 'u1',
      steps: [
        step('Shortlist caterers', 'not_started', { position: 1 }),
        step('Request quotes', 'not_started', { position: 2 }),
      ],
    });

    expect(
      lines({ workstreams: [notStarted], users: [user({ id: 'u1' })] }),
    ).toEqual(['w1 Catering [NotStarted] · 2 steps · owner Alice Doe']);
  });

  it('replaces complete workstreams with a bare count', () => {
    expect(
      lines({
        workstreams: [
          activeCatering,
          workstream({ id: 'w2', lifecycle: 'complete' }),
          workstream({ id: 'w3', lifecycle: 'complete' }),
        ],
      }),
    ).toEqual([
      'w1 Catering [Active] · 3/7 step-Book tasting "Book tasting" · due 2026-09-12',
      '2 complete (not listed)',
    ]);
  });

  it('reports an empty project rather than an empty string', () => {
    expect(lines()).toEqual(['no workstreams']);
  });

  it('still reports the complete count when nothing else is listed', () => {
    expect(
      lines({ workstreams: [workstream({ lifecycle: 'complete' })] }),
    ).toEqual(['1 complete (not listed)']);
  });
});
