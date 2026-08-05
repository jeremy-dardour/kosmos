import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { invalidateProjectsList } from '@/api/hooks/use-projects';

import type { dtos } from '@/types/openapi';

export type UpdateProjectInput = dtos['UpdateProjectDto'];

export function useUpdateProject(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'patch',
    '/api/projects/{id}',
    {
      onSuccess: async () => {
        // A project edit changes name/eventDate, which are cached in two
        // places: the overview aggregate (what the header renders) and the
        // projects-list query. Invalidate both, or one serves stale data.
        await Promise.all([
          invalidateOverview(),
          invalidateProjectsList(queryClient),
        ]);
      },
    },
    queryClient,
  );
}
