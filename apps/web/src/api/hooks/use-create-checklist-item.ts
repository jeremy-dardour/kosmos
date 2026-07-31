import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type CreateChecklistItemInput = dtos['CreateChecklistItemDto'];

export function useCreateChecklistItem(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'post',
    '/api/steps/{stepId}/checklist-items',
    {
      onSuccess: (checklistItem, variables) =>
        patchOverview({
          type: 'checklist-item-added',
          stepId: variables.params.path.stepId,
          checklistItem,
        }),
    },
    queryClient,
  );
}
