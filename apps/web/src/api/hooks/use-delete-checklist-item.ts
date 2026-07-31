import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

export function useDeleteChecklistItem(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'delete',
    '/api/checklist-items/{id}',
    {
      onSuccess: (_data, variables) =>
        patchOverview({
          type: 'checklist-item-removed',
          checklistItemId: variables.params.path.id,
        }),
    },
    queryClient,
  );
}
