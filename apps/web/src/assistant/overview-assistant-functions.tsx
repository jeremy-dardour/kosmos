import { useQueryClient } from '@tanstack/react-query';
import { useAgoFunction } from '@useago/sdk/react';

import { addStepsFunction } from '@/assistant/functions/add-steps';
import { createWorkstreamFunction } from '@/assistant/functions/create-workstream';
import { getWorkstreamFunction } from '@/assistant/functions/get-workstream';
import { updateStepFunction } from '@/assistant/functions/update-step';

interface OverviewAssistantFunctionsProperties {
  projectId: string;
}

/**
 * The overview's page-scoped assistant functions. Mounted only while the
 * overview is on screen, so they register on arrival and unregister on
 * navigation away.
 */
export const OverviewAssistantFunctions = ({
  projectId,
}: OverviewAssistantFunctionsProperties) => {
  const queryClient = useQueryClient();

  useAgoFunction(getWorkstreamFunction(queryClient, projectId));
  useAgoFunction(createWorkstreamFunction(queryClient, projectId));
  useAgoFunction(addStepsFunction(queryClient, projectId));
  useAgoFunction(updateStepFunction(queryClient, projectId));

  return null;
};
