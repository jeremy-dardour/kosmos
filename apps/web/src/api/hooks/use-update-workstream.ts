import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type UpdateWorkstreamInput = dtos['UpdateWorkstreamDto'];

export function useUpdateWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'patch',
    '/api/workstreams/{id}',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}

/**
 * Same PATCH, committed the inline overview's way. It stays a second export
 * only while the pre-inline dialogs need the invalidating variant above.
 */
export function useUpdateWorkstreamInline(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'patch',
    '/api/workstreams/{id}',
    {
      onSuccess: (workstream) =>
        patchOverview({ type: 'workstream', workstream }),
    },
    queryClient,
  );
}
