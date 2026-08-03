import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { overviewQueryOptions } from '@/api/hooks/use-overview';

/**
 * The dialog mutations' refresh model: flows whose responses are not patchable
 * into the aggregate (workstream create/delete, group CRUD, project settings)
 * refetch it whole. Everything else commits through `useOverviewCache`; the
 * one crossover is a reorder recovering from a rejected drag.
 */
export function useInvalidateOverview(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!projectId) return;

    await queryClient.invalidateQueries({
      queryKey: overviewQueryOptions(projectId).queryKey,
    });
  }, [projectId, queryClient]);
}
