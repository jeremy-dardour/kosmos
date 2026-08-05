import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { overviewQueryOptions } from '@/api/hooks/use-overview';
import { invalidateProjectsList } from '@/api/hooks/use-projects';

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'delete',
    '/api/projects/{id}',
    {
      // Also drop the deleted project's cached overview, so a later restore
      // cannot re-enter it stale.
      onSuccess: async (_data, variables) => {
        await Promise.all([
          invalidateProjectsList(queryClient),
          queryClient.invalidateQueries({
            queryKey: overviewQueryOptions(variables.params.path.id).queryKey,
          }),
        ]);
      },
    },
    queryClient,
  );
}
