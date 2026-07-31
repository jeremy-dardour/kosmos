import { StepOutcome } from '@/database/entities/step.entity';
import {
  buildStep,
  buildWorkstream,
} from '@/modules/project/__tests__/helpers/pipeline-entities';
import {
  assertInsertablePosition,
  assertPipelineMutable,
  assertStepDeletable,
  assertStepEditable,
} from '@/modules/project/utils/step-mutability.util';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { Step } from '@/database/entities/step.entity';
import type { Workstream } from '@/database/entities/workstream.entity';

interface Conflict {
  typeSlug: string;
  status: number;
}

/** The problem details of the conflict `run` is expected to throw. */
function conflictFrom(run: () => void): Conflict {
  try {
    run();
  } catch (error) {
    if (error instanceof ProblemDetailsException) {
      return { typeSlug: error.typeSlug, status: error.getStatus() };
    }

    throw error;
  }

  return { typeSlug: 'nothing was thrown', status: 0 };
}

function conflict(typeSlug: string): Conflict {
  return { typeSlug, status: 409 };
}

/** Past → current → future, with the pointer on step 2. */
function activeWorkstream(): { workstream: Workstream; steps: Step[] } {
  const past = buildStep({
    id: 'past',
    position: 1,
    outcome: StepOutcome.Done,
  });
  const current = buildStep({ id: 'current', position: 2 });
  const future = buildStep({ id: 'future', position: 3 });

  return {
    workstream: buildWorkstream({
      startedAt: new Date('2026-07-01'),
      currentStep: current,
      steps: [past, current, future],
    }),
    steps: [past, current, future],
  };
}

describe('assertStepEditable', () => {
  it('accepts a current or future step', () => {
    const [, current, future] = activeWorkstream().steps;

    expect(() => assertStepEditable(current!)).not.toThrow();
    expect(() => assertStepEditable(future!)).not.toThrow();
  });

  it('rejects a step with an outcome as frozen', () => {
    const [past] = activeWorkstream().steps;

    expect(conflictFrom(() => assertStepEditable(past!))).toEqual(
      conflict('step-frozen'),
    );
  });

  it('treats a skipped step as past', () => {
    const skipped = buildStep({ position: 1, outcome: StepOutcome.Skipped });

    expect(conflictFrom(() => assertStepEditable(skipped))).toEqual(
      conflict('step-frozen'),
    );
  });
});

describe('assertStepDeletable', () => {
  it('accepts a future step', () => {
    const { workstream, steps } = activeWorkstream();

    expect(() => assertStepDeletable(workstream, steps[2]!)).not.toThrow();
  });

  it('rejects the current step', () => {
    const { workstream, steps } = activeWorkstream();

    expect(
      conflictFrom(() => assertStepDeletable(workstream, steps[1]!)),
    ).toEqual(conflict('step-not-deletable'));
  });

  it('rejects a past step as frozen', () => {
    const { workstream, steps } = activeWorkstream();

    expect(
      conflictFrom(() => assertStepDeletable(workstream, steps[0]!)),
    ).toEqual(conflict('step-frozen'));
  });

  it('accepts every step of a not-started workstream', () => {
    const steps = [buildStep({ position: 1 }), buildStep({ position: 2 })];
    const workstream = buildWorkstream({ steps });

    for (const step of steps) {
      expect(() => assertStepDeletable(workstream, step)).not.toThrow();
    }
  });
});

describe('assertPipelineMutable', () => {
  it('accepts not-started and active workstreams', () => {
    expect(() =>
      assertPipelineMutable(buildWorkstream({ steps: [] })),
    ).not.toThrow();
    expect(() =>
      assertPipelineMutable(activeWorkstream().workstream),
    ).not.toThrow();
  });

  it('rejects a complete workstream', () => {
    const workstream = buildWorkstream({
      startedAt: new Date('2026-07-01'),
      completedAt: new Date('2026-07-02'),
      steps: [buildStep({ position: 1, outcome: StepOutcome.Done })],
    });

    expect(conflictFrom(() => assertPipelineMutable(workstream))).toEqual(
      conflict('step-frozen'),
    );
  });
});

describe('assertInsertablePosition', () => {
  it('accepts any position in a not-started workstream, including the tail', () => {
    const workstream = buildWorkstream({
      steps: [buildStep({ position: 1 }), buildStep({ position: 2 })],
    });

    for (const position of [1, 2, 3]) {
      expect(() =>
        assertInsertablePosition(workstream, position),
      ).not.toThrow();
    }
  });

  it('accepts positions after the pointer in an active workstream', () => {
    const { workstream } = activeWorkstream();

    for (const position of [3, 4]) {
      expect(() =>
        assertInsertablePosition(workstream, position),
      ).not.toThrow();
    }
  });

  it('rejects the current position and everything before it', () => {
    const { workstream } = activeWorkstream();

    for (const position of [1, 2]) {
      expect(
        conflictFrom(() => assertInsertablePosition(workstream, position)),
      ).toEqual(conflict('step-insertion-illegal'));
    }
  });

  it('rejects a position that would leave a gap', () => {
    const { workstream } = activeWorkstream();

    expect(conflictFrom(() => assertInsertablePosition(workstream, 5))).toEqual(
      conflict('step-insertion-illegal'),
    );
  });

  it('rejects any position in a complete workstream', () => {
    const workstream = buildWorkstream({
      startedAt: new Date('2026-07-01'),
      completedAt: new Date('2026-07-02'),
      steps: [buildStep({ position: 1, outcome: StepOutcome.Done })],
    });

    expect(conflictFrom(() => assertInsertablePosition(workstream, 2))).toEqual(
      conflict('step-insertion-illegal'),
    );
  });
});
