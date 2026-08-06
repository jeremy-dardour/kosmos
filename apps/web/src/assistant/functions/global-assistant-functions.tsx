import { useQueryClient } from '@tanstack/react-query';
import { useAgoFunction } from '@useago/sdk/react';

import { listProjectsFunction } from '@/assistant/functions/list-projects';

/**
 * Registers the assistant's app-wide functions. Handlers fetch on invocation
 * (cache-first), so nothing loads just because this is mounted. Mount only
 * where an Ago client exists.
 */
export const GlobalAssistantFunctions = () => {
  const queryClient = useQueryClient();

  useAgoFunction(listProjectsFunction(queryClient));

  return null;
};
