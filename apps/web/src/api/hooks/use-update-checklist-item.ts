import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type UpdateChecklistItemInput = dtos['UpdateChecklistItemDto'];

export function useUpdateChecklistItem(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'patch',
    '/api/checklist-items/{id}',
    {
      onSuccess: (checklistItem) =>
        patchOverview({ type: 'checklist-item-changed', checklistItem }),
    },
    queryClient,
  );
}
