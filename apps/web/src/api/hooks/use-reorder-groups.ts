import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type ReorderGroupsInput = dtos['ReorderGroupsDto'];

export function useReorderGroups(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'put',
    '/api/projects/{projectId}/group-order',
    {
      onSuccess: (groups) => patchOverview({ type: 'group-order', groups }),
    },
    queryClient,
  );
}
