import { Collection } from '@mikro-orm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { StepOutcome } from '@/database/entities/step.entity';
import {
  buildChecklistItem,
  buildStep,
  buildUser,
  buildWorkstream,
} from '@/modules/project/__tests__/helpers/pipeline-entities';
import { WorkstreamPipelineService } from '@/modules/project/workstream-pipeline.service';

import type { ChecklistItem } from '@/database/entities/checklist-item.entity';
import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToStep = (step: Step, workstream: Workstream) => void;
type ApplyToItem = (item: ChecklistItem, workstream: Workstream) => void;
type BuildItem = (step: Step, workstream: Workstream) => ChecklistItem;

function createStepService(workstream: Workstream) {
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
    countNotesByStep: vi.fn(() => new Map<string, number>()),
  };
  const userRepository = { findOneOrFail: vi.fn() };

  return {
    service: new WorkstreamPipelineService(
      stepRepository as never,
      {} as never,
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

/** One workstream holding `step`, with the repository lock stubbed away. */
function createChecklistItemService(step: Step) {
  const workstream = buildWorkstream({ steps: [step] });
  const findItem = (id: string): ChecklistItem =>
    step.getChecklistItems().find((item) => item.id === id)!;

  const checklistItemRepository = {
    createLocked: vi.fn((_stepId: string, build: BuildItem) =>
      build(step, workstream),
    ),
    updateLocked: vi.fn((id: string, apply: ApplyToItem) => {
      const item = findItem(id);
      apply(item, workstream);

      return item;
    }),
    removeLocked: vi.fn((id: string, apply: ApplyToItem) => {
      const item = findItem(id);
      apply(item, workstream);
      step.checklistItems.remove(item);
    }),
  };

  return {
    service: new WorkstreamPipelineService(
      {} as never,
      checklistItemRepository as never,
      {} as never,
      {} as never,
    ),
    workstream,
    positions: () =>
      [...step.getChecklistItems()]
        .sort((left, right) => left.position - right.position)
        .map((item) => ({ name: item.name, position: item.position })),
  };
}

function buildPastStep(checklistItems: ChecklistItem[] = []): Step {
  return buildStep({
    id: 'past',
    position: 1,
    outcome: StepOutcome.Done,
    checklistItems,
  });
}

// Steps built inside the service own real Collections, which need an
// EntityManager the unit test has no use for.
beforeEach(() => {
  vi.spyOn(Collection.prototype, 'getItems').mockReturnValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('workstreamPipelineService.createStep', () => {
  it('inserts at the position and shifts the following steps down', async () => {
    const { service, positions } = createStepService(
      buildWorkstream({
        steps: [
          buildStep({ position: 1, name: 'First' }),
          buildStep({ position: 2, name: 'Second' }),
        ],
      }),
    );

    await service.createStep('ws-1', { name: 'Inserted', position: 2 });

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Inserted', position: 2 },
      { name: 'Second', position: 3 },
    ]);
  });

  it('appends after the current step of an active workstream', async () => {
    const current = buildStep({ id: 'current', position: 1, name: 'Current' });
    const { service, positions } = createStepService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await service.createStep('ws-1', { name: 'Next', position: 2 });

    expect(positions()).toEqual([
      { name: 'Current', position: 1 },
      { name: 'Next', position: 2 },
    ]);
  });

  it('rejects an insertion at or before the current step', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const { service } = createStepService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await expect(
      service.createStep('ws-1', { name: 'Too early', position: 1 }),
    ).rejects.toThrow("not in this workstream's future zone");
  });

  it('resolves an explicit owner', async () => {
    const owner = buildUser('u1');
    const workstream = buildWorkstream({ steps: [] });
    const { service, userRepository } = createStepService(workstream);
    userRepository.findOneOrFail.mockResolvedValue(owner);

    await service.createStep('ws-1', {
      name: 'Owned',
      position: 1,
      ownerId: 'u1',
    });

    expect(workstream.getSteps()[0]?.owner).toBe(owner);
  });
});

describe('workstreamPipelineService.updateStep', () => {
  it('applies only the submitted fields', async () => {
    const step = buildStep({
      id: 's1',
      position: 1,
      name: 'Original',
      deadline: '2026-09-01',
      blocked: true,
    });
    const { service } = createStepService(buildWorkstream({ steps: [step] }));

    await service.updateStep('s1', { name: 'Renamed' });

    expect(step).toMatchObject({
      name: 'Renamed',
      deadline: '2026-09-01',
      blocked: true,
    });
  });

  it('clears the deadline and restores owner inheritance on null', async () => {
    const step = buildStep({ id: 's1', position: 1, deadline: '2026-09-01' });
    step.owner = buildUser('u1');
    const { service } = createStepService(buildWorkstream({ steps: [step] }));

    await service.updateStep('s1', { deadline: null, ownerId: null });

    expect(step.deadline).toBeNull();
    expect(step.owner).toBeNull();
  });

  it('accepts blocked on a future step, where it is merely inert', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const future = buildStep({ id: 'future', position: 2 });
    const { service } = createStepService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current, future],
      }),
    );

    await service.updateStep('future', { blocked: true });

    expect(future.blocked).toBe(true);
  });

  it('rejects editing a past step', async () => {
    const past = buildStep({
      id: 'past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    const { service } = createStepService(buildWorkstream({ steps: [past] }));

    await expect(
      service.updateStep('past', { name: 'Rewrite' }),
    ).rejects.toThrow('Past steps cannot be edited');
  });

  it('bumps the workstream timestamp', async () => {
    const step = buildStep({ id: 's1', position: 1 });
    const workstream = buildWorkstream({ steps: [step] });
    const { service } = createStepService(workstream);
    const before = workstream.updatedAt.getTime();

    await service.updateStep('s1', { name: 'Renamed' });

    expect(workstream.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

/** past (done), current, then two future steps. */
function buildActivePipeline(): Workstream {
  const past = buildStep({
    id: 'past',
    position: 1,
    name: 'Past',
    outcome: StepOutcome.Done,
  });
  const current = buildStep({ id: 'current', position: 2, name: 'Current' });
  const first = buildStep({ id: 'f1', position: 3, name: 'First future' });
  const second = buildStep({ id: 'f2', position: 4, name: 'Second future' });

  return buildWorkstream({
    startedAt: new Date('2026-07-01'),
    currentStep: current,
    steps: [past, current, first, second],
  });
}

describe('workstreamPipelineService.reorderSteps', () => {
  it('reorders the future tail without moving past or current steps', async () => {
    const { service, positions } = createStepService(buildActivePipeline());

    await service.reorderSteps('ws-1', { ids: ['f2', 'f1'] });

    expect(positions()).toEqual([
      { name: 'Past', position: 1 },
      { name: 'Current', position: 2 },
      { name: 'Second future', position: 3 },
      { name: 'First future', position: 4 },
    ]);
  });

  it('reorders every step of a not-started workstream', async () => {
    const { service, positions } = createStepService(
      buildWorkstream({
        steps: [
          buildStep({ id: 's1', position: 1, name: 'First' }),
          buildStep({ id: 's2', position: 2, name: 'Second' }),
        ],
      }),
    );

    await service.reorderSteps('ws-1', { ids: ['s2', 's1'] });

    expect(positions()).toEqual([
      { name: 'Second', position: 1 },
      { name: 'First', position: 2 },
    ]);
  });

  it('rejects a list missing a future step', async () => {
    const { service } = createStepService(buildActivePipeline());

    await expect(service.reorderSteps('ws-1', { ids: ['f1'] })).rejects.toThrow(
      "do not match the workstream's future steps",
    );
  });

  it('rejects a list naming the current or a past step', async () => {
    const { service } = createStepService(buildActivePipeline());

    await expect(
      service.reorderSteps('ws-1', { ids: ['current', 'f1', 'f2'] }),
    ).rejects.toThrow("do not match the workstream's future steps");
    await expect(
      service.reorderSteps('ws-1', { ids: ['past', 'f1'] }),
    ).rejects.toThrow("do not match the workstream's future steps");
  });

  it('rejects a duplicated id', async () => {
    const { service } = createStepService(buildActivePipeline());

    await expect(
      service.reorderSteps('ws-1', { ids: ['f1', 'f1'] }),
    ).rejects.toThrow("do not match the workstream's future steps");
  });

  it('rejects reordering a complete workstream', async () => {
    const { service } = createStepService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        completedAt: new Date('2026-07-05'),
        currentStep: null,
        steps: [
          buildStep({ id: 's1', position: 1, outcome: StepOutcome.Done }),
        ],
      }),
    );

    await expect(service.reorderSteps('ws-1', { ids: [] })).rejects.toThrow(
      'Completed workstream pipelines cannot be edited',
    );
  });

  it('bumps the workstream timestamp', async () => {
    const workstream = buildActivePipeline();
    const { service } = createStepService(workstream);
    const before = workstream.updatedAt.getTime();

    await service.reorderSteps('ws-1', { ids: ['f2', 'f1'] });

    expect(workstream.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('workstreamPipelineService.removeStep', () => {
  it('renumbers the steps after the deleted one', async () => {
    const { service, positions } = createStepService(
      buildWorkstream({
        steps: [
          buildStep({ id: 's1', position: 1, name: 'First' }),
          buildStep({ id: 's2', position: 2, name: 'Second' }),
          buildStep({ id: 's3', position: 3, name: 'Third' }),
        ],
      }),
    );

    await service.removeStep('s2');

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 2 },
    ]);
  });

  it('rejects deleting the current step', async () => {
    const current = buildStep({ id: 'current', position: 1 });
    const { service } = createStepService(
      buildWorkstream({
        startedAt: new Date('2026-07-01'),
        currentStep: current,
        steps: [current],
      }),
    );

    await expect(service.removeStep('current')).rejects.toThrow(
      'The current step cannot be deleted while it is in progress',
    );
  });

  it('rejects deleting a past step', async () => {
    const past = buildStep({
      id: 'past',
      position: 1,
      outcome: StepOutcome.Done,
    });
    const { service } = createStepService(buildWorkstream({ steps: [past] }));

    await expect(service.removeStep('past')).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });
});

describe('workstreamPipelineService.createChecklistItem', () => {
  it('appends past the highest position, ignoring holes left by deletions', async () => {
    const { service, positions } = createChecklistItemService(
      buildStep({
        id: 's1',
        position: 1,
        checklistItems: [
          buildChecklistItem('ci1', 'First', 1),
          buildChecklistItem('ci3', 'Third', 3),
        ],
      }),
    );

    await service.createChecklistItem('s1', { name: 'Fourth' });

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 3 },
      { name: 'Fourth', position: 4 },
    ]);
  });

  it('starts an empty step at position one and undone', async () => {
    const { service } = createChecklistItemService(
      buildStep({ id: 's1', position: 1 }),
    );

    const created = await service.createChecklistItem('s1', { name: 'Only' });

    expect(created).toMatchObject({ position: 1, done: false, name: 'Only' });
  });

  it('rejects adding to a past step', async () => {
    const { service } = createChecklistItemService(buildPastStep());

    await expect(
      service.createChecklistItem('past', { name: 'Too late' }),
    ).rejects.toThrow('Past steps cannot be edited');
  });

  it('bumps the workstream timestamp', async () => {
    const { service, workstream } = createChecklistItemService(
      buildStep({ id: 's1', position: 1 }),
    );
    const before = workstream.updatedAt.getTime();

    await service.createChecklistItem('s1', { name: 'Added' });

    expect(workstream.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('workstreamPipelineService.updateChecklistItem', () => {
  it('applies only the submitted fields', async () => {
    const item = buildChecklistItem('ci1', 'Original');
    const { service } = createChecklistItemService(
      buildStep({ id: 's1', position: 1, checklistItems: [item] }),
    );

    await service.updateChecklistItem('ci1', { done: true });
    expect(item).toMatchObject({ name: 'Original', done: true });

    await service.updateChecklistItem('ci1', { name: 'Renamed' });
    expect(item).toMatchObject({ name: 'Renamed', done: true });
  });

  it('rejects editing an item on a past step', async () => {
    const { service } = createChecklistItemService(
      buildPastStep([buildChecklistItem('ci1', 'Frozen')]),
    );

    await expect(
      service.updateChecklistItem('ci1', { done: true }),
    ).rejects.toThrow('Past steps cannot be edited');
  });
});

describe('workstreamPipelineService.removeChecklistItem', () => {
  it('renumbers the items after the deleted one', async () => {
    const { service, positions } = createChecklistItemService(
      buildStep({
        id: 's1',
        position: 1,
        checklistItems: [
          buildChecklistItem('ci1', 'First', 1),
          buildChecklistItem('ci2', 'Second', 2),
          buildChecklistItem('ci3', 'Third', 3),
        ],
      }),
    );

    await service.removeChecklistItem('ci2');

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 2 },
    ]);
  });

  it('rejects deleting an item on a past step', async () => {
    const { service } = createChecklistItemService(
      buildPastStep([buildChecklistItem('ci1', 'Frozen')]),
    );

    await expect(service.removeChecklistItem('ci1')).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });
});
