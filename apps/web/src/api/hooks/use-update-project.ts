import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

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
        // Name/event-date live in both the overview aggregate (header) and the
        // projects list cache used to discover the id.
        const projects = $api.queryOptions('get', '/api/projects');
        await Promise.all([
          invalidateOverview(),
          queryClient.invalidateQueries({ queryKey: projects.queryKey }),
        ]);
      },
    },
    queryClient,
  );
}
