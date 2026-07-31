import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type ReorderWorkstreamsInput = dtos['ReorderWorkstreamsDto'];

export function useReorderWorkstreams(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'put',
    '/api/projects/{projectId}/workstream-order',
    {
      onSuccess: (workstreams) =>
        patchOverview({ type: 'workstream-order', workstreams }),
    },
    queryClient,
  );
}
