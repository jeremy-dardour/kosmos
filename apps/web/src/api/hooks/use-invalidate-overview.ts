import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { overviewQueryOptions } from '@/api/hooks/use-overview';

/**
 * Per-mutation refresh for the components that predate the inline overview.
 * New mutation hooks go through `useOverviewCache` instead.
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
