import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type UpdateWorkstreamInput = dtos['UpdateWorkstreamDto'];

export function useUpdateWorkstream(projectId: string | undefined) {
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
