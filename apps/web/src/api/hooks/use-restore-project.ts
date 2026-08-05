import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { overviewQueryOptions } from '@/api/hooks/use-overview';
import { invalidateProjectsList } from '@/api/hooks/use-projects';

export function useRestoreProject() {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'post',
    '/api/projects/{id}/restore',
    {
      // The restored project's overview may still be cached from before the
      // deletion — refetch it rather than re-entering stale.
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
