import { createChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { createStep } from '@/api/hooks/use-create-step';
import { describeFailure } from '@/assistant/functions/api-failure';
import {
  DEADLINE_SCHEMA,
  resolveDeadline,
} from '@/assistant/functions/deadline';

import type { JsonSchema } from '@/assistant/functions/function-parameters';

export const STEPS_SCHEMA: JsonSchema = {
  type: 'array',
  description:
    'The steps to create, in pipeline order. Positions are assigned for you. Four to eight verb-led, concrete steps make a good pipeline; put deadlines on the milestone steps rather than on every one.',
  items: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Verb-led and concrete, e.g. "Book the tasting".',
      },
      deadline: DEADLINE_SCHEMA,
      ownerId: {
        type: 'string',
        description:
          'A member user id from the project context. Omit to inherit the workstream owner.',
      },
      checklist: {
        type: 'array',
        description:
          'Unordered sub-items for this step. Their progress is informational and gates nothing.',
        items: { type: 'string' },
      },
    },
    required: ['name'],
  },
};

export interface ResolvedStepInput {
  name: string;
  deadline: string | null;
  ownerId: string | null;
  checklist: string[];
}

export type StepInputResolution =
  | { ok: true; steps: ResolvedStepInput[] }
  | { ok: false; error: string };

export interface CreatedStepReport {
  stepId: string;
  name: string;
  position: number;
  checklistItems: string[];
}

export interface StepSequenceOutcome {
  created: CreatedStepReport[];
  failed?: { step: string; checklistItem?: string; reason: string };
  notAttempted: { steps: string[]; checklistItems: string[] };
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export function resolveChecklistNames(
  value: unknown,
  label: string,
): { ok: true; names: string[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, names: [] };
  if (!Array.isArray(value) || value.some((name) => !isNonEmptyString(name))) {
    return { ok: false, error: `${label} must be a list of item names.` };
  }

  return { ok: true, names: value.map((name: string) => name.trim()) };
}

/**
 * Validates and resolves every step up front, so a bad deadline is reported
 * before anything is written rather than halfway through the pipeline.
 */
export function resolveStepInputs(
  value: unknown,
  eventDate: string | null | undefined,
): StepInputResolution {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, error: 'Pass at least one step to create.' };
  }

  const steps: ResolvedStepInput[] = [];
  for (const [index, entry] of value.entries()) {
    const position = `Step ${index + 1}`;
    if (entry === null || typeof entry !== 'object') {
      return { ok: false, error: `${position} is not a step object.` };
    }

    const { name, deadline, ownerId, checklist } = entry as Record<
      string,
      unknown
    >;
    if (!isNonEmptyString(name)) {
      return { ok: false, error: `${position} needs a "name".` };
    }

    const resolvedDeadline = resolveDeadline(deadline, eventDate);
    if (!resolvedDeadline.ok) {
      return {
        ok: false,
        error: `${position} ("${name}"): ${resolvedDeadline.error}`,
      };
    }

    if (
      ownerId !== undefined &&
      ownerId !== null &&
      !isNonEmptyString(ownerId)
    ) {
      return {
        ok: false,
        error: `${position} ("${name}"): "ownerId" must be a member user id.`,
      };
    }

    const resolvedChecklist = resolveChecklistNames(
      checklist,
      `${position} ("${name}"): "checklist"`,
    );
    if (!resolvedChecklist.ok) {
      return { ok: false, error: resolvedChecklist.error };
    }

    steps.push({
      name: name.trim(),
      deadline: resolvedDeadline.deadline,
      ownerId: isNonEmptyString(ownerId) ? ownerId : null,
      checklist: resolvedChecklist.names,
    });
  }

  return { ok: true, steps };
}

interface CreateStepsArguments {
  workstreamId: string;
  steps: readonly ResolvedStepInput[];
  firstPosition: number;
}

const notAttemptedAfter = (
  steps: readonly ResolvedStepInput[],
  index: number,
  remainingChecklistItems: string[],
) => ({
  steps: steps.slice(index + 1).map((step) => step.name),
  checklistItems: remainingChecklistItems,
});

/**
 * Creates the steps in order at contiguous positions, then each step's
 * checklist items. Stops at the first failure and reports what was written,
 * what failed, and what was never attempted — nothing is rolled back.
 */
export async function createStepsInOrder({
  workstreamId,
  steps,
  firstPosition,
}: CreateStepsArguments): Promise<StepSequenceOutcome> {
  const created: CreatedStepReport[] = [];

  for (const [index, step] of steps.entries()) {
    const position = firstPosition + index;

    let stepId: string;
    try {
      const workstream = await createStep(workstreamId, {
        name: step.name,
        position,
        ...(step.deadline !== null && { deadline: step.deadline }),
        ...(step.ownerId !== null && { ownerId: step.ownerId }),
      });
      const inserted = workstream.steps.find(
        (candidate) => candidate.position === position,
      );
      if (!inserted) {
        return {
          created,
          failed: {
            step: step.name,
            reason: 'The server did not return the created step.',
          },
          notAttempted: notAttemptedAfter(steps, index, step.checklist),
        };
      }
      stepId = inserted.id;
    } catch (error) {
      return {
        created,
        failed: { step: step.name, reason: describeFailure(error) },
        notAttempted: notAttemptedAfter(steps, index, step.checklist),
      };
    }

    const report: CreatedStepReport = {
      stepId,
      name: step.name,
      position,
      checklistItems: [],
    };
    created.push(report);

    for (const [itemIndex, item] of step.checklist.entries()) {
      try {
        await createChecklistItem(stepId, { name: item });
        report.checklistItems.push(item);
      } catch (error) {
        return {
          created,
          failed: {
            step: step.name,
            checklistItem: item,
            reason: describeFailure(error),
          },
          notAttempted: notAttemptedAfter(
            steps,
            index,
            step.checklist.slice(itemIndex + 1),
          ),
        };
      }
    }
  }

  return { created, notAttempted: { steps: [], checklistItems: [] } };
}
