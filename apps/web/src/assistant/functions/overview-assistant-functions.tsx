import { useQueryClient } from '@tanstack/react-query';
import { useAgoFunction } from '@useago/sdk/react';

import { listMembersFunction } from '@/assistant/functions/list-members';

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

  useAgoFunction(listMembersFunction(queryClient, projectId));

  return null;
};
