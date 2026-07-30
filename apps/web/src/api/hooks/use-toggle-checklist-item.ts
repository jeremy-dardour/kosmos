import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

export function useToggleChecklistItem(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'patch',
    '/api/checklist-items/{id}',
    {
      onSuccess: async () => {
        if (!projectId) return;

        const overview = $api.queryOptions(
          'get',
          '/api/projects/{projectId}/overview',
          { params: { path: { projectId } } },
        );
        await queryClient.invalidateQueries({ queryKey: overview.queryKey });
      },
    },
    queryClient,
  );
}
