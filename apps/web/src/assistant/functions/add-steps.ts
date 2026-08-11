import { fetchOverview, refreshOverview } from '@/api/hooks/use-overview';
import { asFunctionParameters } from '@/assistant/functions/function-parameters';
import { resolveInsertionPosition } from '@/assistant/functions/pipeline-mutability';
import {
  STEPS_SCHEMA,
  createStepsInOrder,
  resolveStepInputs,
} from '@/assistant/functions/step-sequence';

import type { QueryClient } from '@tanstack/react-query';
import type { ClientFunctionDefinition } from '@useago/sdk';

const definition: Omit<ClientFunctionDefinition, 'handler'> = {
  name: 'addSteps',
  description:
    'Add steps to an existing workstream of the project on screen, inserted after a step you name or at the end of the pipeline. Only the future zone accepts new steps: past steps and the step in progress cannot be inserted behind, and a complete workstream accepts none. Call getWorkstream first if you are unsure where the pipeline currently stands. Steps cannot be reordered or deleted afterwards, so propose the additions and wait for the user to agree before calling.',
  parameters: asFunctionParameters({
    type: 'object',
    properties: {
      workstreamId: {
        type: 'string',
        description:
          'The workstream to add to, from the workstreams context or getWorkstream.',
      },
      after: {
        type: 'string',
        description:
          'The id of the step the new steps go behind, or "end" to append them to the pipeline.',
      },
      steps: STEPS_SCHEMA,
    },
    required: ['workstreamId', 'after', 'steps'],
  }),
};

export const addStepsFunction = (
  queryClient: QueryClient,
  projectId: string,
): ClientFunctionDefinition => ({
  ...definition,
  handler: async (arguments_) => {
    const overview = await fetchOverview(queryClient, projectId);
    const workstream = overview.workstreams.find(
      (candidate) => candidate.id === arguments_.workstreamId,
    );
    if (!workstream) {
      return {
        success: false,
        error: `No workstream with id "${String(arguments_.workstreamId)}" in this project. Ids come from the workstreams context.`,
      };
    }

    const resolved = resolveStepInputs(
      arguments_.steps,
      overview.project.eventDate,
    );
    if (!resolved.ok) return { success: false, error: resolved.error };

    const insertion = resolveInsertionPosition(workstream, arguments_.after);
    if (!insertion.ok) return { success: false, error: insertion.error };

    const outcome = await createStepsInOrder({
      workstreamId: workstream.id,
      steps: resolved.steps,
      firstPosition: insertion.position,
    });
    await refreshOverview(queryClient, projectId);

    if (outcome.failed) {
      return {
        success: false,
        workstreamId: workstream.id,
        created: outcome.created,
        failed: outcome.failed,
        notAttempted: outcome.notAttempted,
        message:
          'The steps listed under "created" exist and are on screen; nothing was rolled back. Tell the user exactly what was added and what was not.',
      };
    }

    return {
      success: true,
      workstreamId: workstream.id,
      created: outcome.created,
    };
  },
});
