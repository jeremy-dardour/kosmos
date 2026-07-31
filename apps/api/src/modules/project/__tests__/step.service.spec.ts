import { Collection } from '@mikro-orm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StepOutcome } from '@/database/entities/step.entity';
import {
  buildStep,
  buildUser,
  buildWorkstream,
} from '@/modules/project/__tests__/helpers/pipeline-entities';
import { StepService } from '@/modules/project/step.service';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToStep = (step: Step, workstream: Workstream) => void;

function createService(workstream: Workstream) {
  const findStep = (id: string): Step =>
    workstream.getSteps().find((step) => step.id === id)!;

  const stepRepository = {
    updateLocked: vi.fn((id: string, apply: ApplyToStep) => {
      const step = findStep(id);
      apply(step, workstream);

      return { workstream, step };
    }),
    removeLocked: vi.fn((id: string, apply: ApplyToStep) => {
      const step = findStep(id);
      apply(step, workstream);
      workstream.steps.remove(step);

      return workstream;
    }),
  };
  const workstreamRepository = {
    updateLockedDetails: vi.fn(
      (_id: string, apply: (target: Workstream) => void) => {
        apply(workstream);

        return workstream;
      },
    ),
    findDetails: vi.fn(() => workstream),
    countNotesByStep: vi.fn(() => new Map<string, number>()),
  };
  const userRepository = { findOneOrFail: vi.fn() };

  return {
    service: new StepService(
      stepRepository as never,
      workstreamRepository as never,
      userRepository as never,
    ),
    userRepository,
    positions: () =>
      [...workstream.getSteps()]
        .sort((left, right) => left.position - right.position)
        .map((step) => ({ name: step.name, position: step.position })),
  };
}

// Steps built inside the service own real Collections, which need an
// EntityManager the unit test has no use for.
beforeEach(() => {
  vi.spyOn(Collection.prototype, 'getItems').mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('stepService.create', () => {
  it('inserts at the position and shifts the following steps down', async () => {
    const { service, positions } = createService(
      buildWorkstream({
        steps: [
          buildStep({ position: 1, name: 'First' }),
          buildStep({ position: 2, name: 'Second' }),
        ],
      }),
    );

    await service.create('ws-1', { name: 'Inserted', position: 2 });

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Inserted', position: 2 },
      { name: 'Second', position: 3 },
    ]);
  });

  it('appends after the current step of an active workstream', async () => {
    const current = buildStep({ id: 'current', position: 1, name: 'Current' });
    const { service, positions } = createService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await service.create('ws-1', { name: 'Next', position: 2 });

    expect(positions()).toEqual([
      { name: 'Current', position: 1 },
      { name: 'Next', position: 2 },
    ]);
  });

  it('rejects an insertion at or before the current step', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const { service } = createService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await expect(
      service.create('ws-1', { name: 'Too early', position: 1 }),
    ).rejects.toThrow("not in this workstream's future zone");
  });

  it('resolves an explicit owner', async () => {
    const owner = buildUser('u1');
    const workstream = buildWorkstream({ steps: [] });
    const { service, userRepository } = createService(workstream);
    userRepository.findOneOrFail.mockResolvedValue(owner);

    await service.create('ws-1', {
      name: 'Owned',
      position: 1,
      ownerId: 'u1',
    });

    expect(workstream.getSteps()[0]?.owner).toBe(owner);
  });
});

describe('stepService.update', () => {
  it('applies only the submitted fields', async () => {
    const step = buildStep({
      id: 's1',
      position: 1,
      name: 'Original',
      deadline: '2026-09-01',
      blocked: true,
    });
    const { service } = createService(buildWorkstream({ steps: [step] }));

    await service.update('s1', { name: 'Renamed' });

    expect(step).toMatchObject({
      name: 'Renamed',
      deadline: '2026-09-01',
      blocked: true,
    });
  });

  it('clears the deadline and restores owner inheritance on null', async () => {
    const step = buildStep({ id: 's1', position: 1, deadline: '2026-09-01' });
    step.owner = buildUser('u1');
    const { service } = createService(buildWorkstream({ steps: [step] }));

    await service.update('s1', { deadline: null, ownerId: null });

    expect(step.deadline).toBeNull();
    expect(step.owner).toBeNull();
  });

  it('accepts blocked on a future step, where it is merely inert', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const future = buildStep({ id: 'future', position: 2 });
    const { service } = createService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current, future],
      }),
    );

    await service.update('future', { blocked: true });

    expect(future.blocked).toBe(true);
  });

  it('rejects editing a past step', async () => {
    const past = buildStep({
      id: 'past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    const { service } = createService(buildWorkstream({ steps: [past] }));

    await expect(service.update('past', { name: 'Rewrite' })).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });

  it('bumps the workstream timestamp so pipeline drafts go stale', async () => {
    const step = buildStep({ id: 's1', position: 1 });
    const workstream = buildWorkstream({ steps: [step] });
    const { service } = createService(workstream);
    const before = workstream.updatedAt.getTime();

    await service.update('s1', { name: 'Renamed' });

    expect(workstream.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('stepService.remove', () => {
  it('renumbers the steps after the deleted one', async () => {
    const { service, positions } = createService(
      buildWorkstream({
        steps: [
          buildStep({ id: 's1', position: 1, name: 'First' }),
          buildStep({ id: 's2', position: 2, name: 'Second' }),
          buildStep({ id: 's3', position: 3, name: 'Third' }),
        ],
      }),
    );

    await service.remove('s2');

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 2 },
    ]);
  });

  it('rejects deleting the current step', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const { service } = createService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await expect(service.remove('current')).rejects.toThrow(
      'The current step cannot be deleted while it is in progress',
    );
  });

  it('rejects deleting a past step', async () => {
    const past = buildStep({
      id: 'past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    const { service } = createService(buildWorkstream({ steps: [past] }));

    await expect(service.remove('past')).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });
});
