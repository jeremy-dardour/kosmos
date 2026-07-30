import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { $api } from '@/api/api-client';

/**
 * The overview aggregate is the one read that every workstream, group, and
 * project mutation can change. This hook hides its query key behind a single
 * callback so callers never reconstruct it.
 */
export function useInvalidateOverview(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (!projectId) return;

    const overview = $api.queryOptions(
      'get',
      '/api/projects/{projectId}/overview',
      { params: { path: { projectId } } },
    );
    await queryClient.invalidateQueries({ queryKey: overview.queryKey });
  }, [projectId, queryClient]);
}
