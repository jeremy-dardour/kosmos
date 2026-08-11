import { createChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { updateStep } from '@/api/hooks/use-update-step';
import { describeFailure } from '@/assistant/functions/api-failure';
import {
  DEADLINE_SCHEMA,
  resolveDeadline,
} from '@/assistant/functions/deadline';
import { requireStep } from '@/assistant/functions/entity-lookup';
import { asFunctionParameters } from '@/assistant/functions/function-parameters';
import { resolveChecklistNames } from '@/assistant/functions/step-sequence';
import { isStepEditable } from '@/features/overview/step-mutability';

import type { Step } from '@/api/hooks/use-overview';
import type { UpdateStepInput } from '@/api/hooks/use-update-step';
import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'updateStep',
  description:
    'Change one step of the project on screen — its name, deadline, owner or blocked flag — and add checklist items to it. The step in progress and every step ahead of it can be changed; steps already done or skipped are frozen. Nothing here removes a checklist item or moves a step.',
  parameters: asFunctionParameters({
    type: 'object',
    properties: {
      stepId: {
        type: 'string',
        description: 'The step id, from the context or getWorkstream.',
      },
      name: { type: 'string', description: 'A new name for the step.' },
      deadline: DEADLINE_SCHEMA,
      ownerId: {
        type: 'string',
        description:
          'A member user id from the project context; null restores inheritance from the workstream owner.',
      },
      blocked: {
        type: 'boolean',
        description:
          'Informational flag, meaningful on the step in progress. It never prevents anything.',
      },
      addChecklistItems: {
        type: 'array',
        description: 'Names of checklist sub-items to append to the step.',
        items: { type: 'string' },
      },
    },
    required: ['stepId'],
  }),
};

interface StepWrite {
  step: Step;
  update: UpdateStepInput;
  checklistItems: readonly string[];
  isCurrentStep: boolean;
}

async function writeStepChanges({
  step,
  update,
  checklistItems,
  isCurrentStep,
}: StepWrite) {
  if (Object.keys(update).length > 0) {
    try {
      await updateStep(step.id, update);
    } catch (error) {
      return {
        success: false,
        stepUpdated: false,
        error: describeFailure(error),
        notAttempted: { checklistItems },
      };
    }
  }

  const checklistItemsCreated: string[] = [];
  for (const [index, item] of checklistItems.entries()) {
    try {
      await createChecklistItem(step.id, { name: item });
      checklistItemsCreated.push(item);
    } catch (error) {
      return {
        success: false,
        stepUpdated: true,
        checklistItemsCreated,
        failed: { checklistItem: item, reason: describeFailure(error) },
        notAttempted: { checklistItems: checklistItems.slice(index + 1) },
        message:
          'The step change and the checklist items listed as created are on screen; nothing was rolled back.',
      };
    }
  }

  return {
    success: true,
    stepId: step.id,
    updated: Object.keys(update),
    checklistItemsCreated,
    ...(update.blocked !== undefined &&
      !isCurrentStep && {
        note: `"${step.name}" is not the step in progress, so its blocked flag has no effect until the workstream reaches it.`,
      }),
  };
}

export const updateStepFunction = (
  queryClient: QueryClient,
  projectId: string,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async (arguments_) => {
    const overview = await fetchOverview(queryClient, projectId);
    const found = requireStep(overview, arguments_.stepId);
    if (!found.ok) return { success: false, error: found.error };

    const { workstream, step } = found;
    if (!isStepEditable(step)) {
      return {
        success: false,
        error: `"${step.name}" is already ${step.status === 'done' ? 'done' : 'skipped'}, and past steps are frozen. Nothing was changed.`,
      };
    }

    const update: UpdateStepInput = {};
    const { name, deadline, ownerId, blocked } = arguments_;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return { success: false, error: '"name" must be a non-empty string.' };
      }
      update.name = name.trim();
    }

    if (deadline !== undefined) {
      const resolved = resolveDeadline(deadline, overview.project.eventDate);
      if (!resolved.ok) return { success: false, error: resolved.error };
      update.deadline = resolved.deadline;
    }

    if (ownerId !== undefined) {
      if (ownerId !== null && typeof ownerId !== 'string') {
        return {
          success: false,
          error: '"ownerId" must be a member user id, or null to unassign.',
        };
      }
      update.ownerId = ownerId;
    }

    if (blocked !== undefined) {
      if (typeof blocked !== 'boolean') {
        return { success: false, error: '"blocked" must be true or false.' };
      }
      update.blocked = blocked;
    }

    const checklist = resolveChecklistNames(
      arguments_.addChecklistItems,
      '"addChecklistItems"',
    );
    if (!checklist.ok) return { success: false, error: checklist.error };

    if (Object.keys(update).length === 0 && checklist.names.length === 0) {
      return {
        success: false,
        error:
          'Nothing to change: pass at least one of name, deadline, ownerId, blocked or addChecklistItems.',
      };
    }

    const outcome = await writeStepChanges({
      step,
      update,
      checklistItems: checklist.names,
      isCurrentStep: workstream.currentStepId === step.id,
    });
    await refreshOverview(queryClient, projectId);

    return outcome;
  },
});
