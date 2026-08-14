import { createWorkstream } from '@/api/hooks/use-create-workstream';
import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { describeFailure } from '@/assistant/functions/api-failure';
import { asFunctionParameters } from '@/assistant/functions/function-parameters';
import {
  STEPS_SCHEMA,
  createStepsInOrder,
  resolveStepInputs,
} from '@/assistant/functions/step-sequence';

import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'createWorkstream',
  description:
    'Create a workstream in the project on screen together with its whole pipeline — every step, its deadline and owner, and its checklist items — in one call. Only call after the user has agreed to the proposed pipeline in this conversation: state the steps you intend to create and wait for their agreement first. Nothing here can be undone, reordered or deleted afterwards.',
  parameters: asFunctionParameters({
    type: 'object',
    properties: {
      name: { type: 'string', description: 'The workstream name.' },
      icon: {
        type: 'string',
        description:
          'A single emoji that suits the workstream, e.g. "🍽️" for catering. Required — creation fails without one.',
      },
      groupId: {
        type: 'string',
        description:
          'A group id from the project context. Omit to leave the workstream ungrouped.',
      },
      ownerId: {
        type: 'string',
        description:
          'A member user id from the project context, used as the default owner for every step that has none.',
      },
      steps: STEPS_SCHEMA,
    },
    required: ['name', 'icon', 'steps'],
  }),
};

export const createWorkstreamFunction = (
  queryClient: QueryClient,
  projectId: string,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async (arguments_) => {
    const { name, icon, groupId, ownerId } = arguments_;
    if (typeof name !== 'string' || name.trim().length === 0) {
      return { success: false, error: 'A workstream needs a "name".' };
    }
    if (typeof icon !== 'string' || icon.trim().length === 0) {
      return {
        success: false,
        error:
          'A workstream needs an "icon" — pick a single emoji that suits it.',
      };
    }

    const overview = await fetchOverview(queryClient, projectId);
    const resolved = resolveStepInputs(
      arguments_.steps,
      overview.project.eventDate,
    );
    if (!resolved.ok) {
      return {
        success: false,
        workstreamCreated: false,
        error: resolved.error,
      };
    }

    let workstreamId: string;
    try {
      const workstream = await createWorkstream(projectId, {
        name: name.trim(),
        icon: icon.trim(),
        ...(typeof groupId === 'string' && { groupId }),
        ...(typeof ownerId === 'string' && { ownerId }),
      });
      workstreamId = workstream.id;
    } catch (error) {
      return {
        success: false,
        workstreamCreated: false,
        error: describeFailure(error),
        notAttempted: { steps: resolved.steps.map((step) => step.name) },
      };
    }

    const outcome = await createStepsInOrder({
      workstreamId,
      steps: resolved.steps,
      firstPosition: 1,
    });
    await refreshOverview(queryClient, projectId);

    if (outcome.failed) {
      return {
        success: false,
        workstreamCreated: true,
        workstreamId,
        created: outcome.created,
        failed: outcome.failed,
        notAttempted: outcome.notAttempted,
        message:
          'The workstream and the steps listed under "created" exist and are on screen; nothing was rolled back. Tell the user exactly what was created and what was not, and offer to finish it with addSteps or updateStep.',
      };
    }

    return {
      success: true,
      workstreamCreated: true,
      workstreamId,
      created: outcome.created,
    };
  },
});
