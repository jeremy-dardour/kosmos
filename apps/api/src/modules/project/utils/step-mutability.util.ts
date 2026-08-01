import { WorkstreamLifecycle } from '@/database/entities/workstream.entity';
import { conflict } from '@/modules/project/utils/conflict.util';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

/**
 * The Decision 33 mutability rules, re-validated per operation against current
 * server state: past steps are frozen, the current step accepts attribute edits
 * but no structural change, future steps are fully mutable.
 */

/** Past steps only accept appended notes. `blocked` stays writable elsewhere. */
export function assertStepEditable(step: Step): void {
  if (step.outcome != null) {
    conflict('step-frozen', 'Past steps cannot be edited');
  }
}

export function assertStepDeletable(workstream: Workstream, step: Step): void {
  assertStepEditable(step);

  if (workstream.currentStep?.id === step.id) {
    conflict(
      'step-not-deletable',
      'The current step cannot be deleted while it is in progress',
    );
  }
}

export function assertPipelineMutable(workstream: Workstream): void {
  if (workstream.getLifecycle() === WorkstreamLifecycle.Complete) {
    conflict('step-frozen', 'Completed workstream pipelines cannot be edited');
  }
}

/**
 * The steps strictly after the pointer, in position order — the zone that
 * accepts structural change. A NotStarted workstream has no pointer, so every
 * step is future; a Complete one has none.
 */
export function futureSteps(workstream: Workstream): Step[] {
  const pointerPosition = workstream.currentStep?.position ?? 0;

  return workstream
    .getSteps()
    .filter((step) => step.position > pointerPosition && step.outcome == null)
    .sort((left, right) => left.position - right.position);
}

/**
 * Insertion is legal strictly after the pointer, and only where it keeps
 * positions contiguous. A complete workstream has no future zone at all.
 */
export function assertInsertablePosition(
  workstream: Workstream,
  position: number,
): void {
  const isComplete = workstream.getLifecycle() === WorkstreamLifecycle.Complete;
  const pointerPosition = workstream.currentStep?.position ?? 0;
  const stepCount = workstream.getSteps().length;

  if (isComplete || position <= pointerPosition || position > stepCount + 1) {
    conflict(
      'step-insertion-illegal',
      `Position ${position} is not in this workstream's future zone`,
    );
  }
}
