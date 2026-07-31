import { describe, expect, it, vi } from 'vitest';

import { StepOutcome } from '@/database/entities/step.entity';
import {
  buildChecklistItem,
  buildStep,
  buildWorkstream,
} from '@/modules/project/__tests__/helpers/pipeline-entities';
import { ChecklistItemService } from '@/modules/project/checklist-item.service';

import type { ChecklistItem } from '@/database/entities/checklist-item.entity';
import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

type ApplyToItem = (item: ChecklistItem, workstream: Workstream) => void;
type BuildItem = (step: Step, workstream: Workstream) => ChecklistItem;

/** One workstream holding `step`, with the repository lock stubbed away. */
function createService(step: Step) {
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
    service: new ChecklistItemService(checklistItemRepository as never),
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

describe('checklistItemService.create', () => {
  it('appends past the highest position, ignoring holes left by deletions', async () => {
    const { service, positions } = createService(
      buildStep({
        id: 's1',
        position: 1,
        checklistItems: [
          buildChecklistItem('ci1', 'First', 1),
          buildChecklistItem('ci3', 'Third', 3),
        ],
      }),
    );

    await service.create('s1', { name: 'Fourth' });

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 3 },
      { name: 'Fourth', position: 4 },
    ]);
  });

  it('starts an empty step at position one and undone', async () => {
    const { service } = createService(buildStep({ id: 's1', position: 1 }));

    const created = await service.create('s1', { name: 'Only' });

    expect(created).toMatchObject({ position: 1, done: false, name: 'Only' });
  });

  it('rejects adding to a past step', async () => {
    const { service } = createService(buildPastStep());

    await expect(service.create('past', { name: 'Too late' })).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });

  it('bumps the workstream timestamp so pipeline drafts go stale', async () => {
    const { service, workstream } = createService(
      buildStep({ id: 's1', position: 1 }),
    );
    const before = workstream.updatedAt.getTime();

    await service.create('s1', { name: 'Added' });

    expect(workstream.updatedAt.getTime()).toBeGreaterThan(before);
  });
});

describe('checklistItemService.update', () => {
  it('applies only the submitted fields', async () => {
    const item = buildChecklistItem('ci1', 'Original');
    const { service } = createService(
      buildStep({ id: 's1', position: 1, checklistItems: [item] }),
    );

    await service.update('ci1', { done: true });
    expect(item).toMatchObject({ name: 'Original', done: true });

    await service.update('ci1', { name: 'Renamed' });
    expect(item).toMatchObject({ name: 'Renamed', done: true });
  });

  it('rejects editing an item on a past step', async () => {
    const { service } = createService(
      buildPastStep([buildChecklistItem('ci1', 'Frozen')]),
    );

    await expect(service.update('ci1', { done: true })).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });
});

describe('checklistItemService.remove', () => {
  it('renumbers the items after the deleted one', async () => {
    const { service, positions } = createService(
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

    await service.remove('ci2');

    expect(positions()).toEqual([
      { name: 'First', position: 1 },
      { name: 'Third', position: 2 },
    ]);
  });

  it('rejects deleting an item on a past step', async () => {
    const { service } = createService(
      buildPastStep([buildChecklistItem('ci1', 'Frozen')]),
    );

    await expect(service.remove('ci1')).rejects.toThrow(
      'Past steps cannot be edited',
    );
  });
});
