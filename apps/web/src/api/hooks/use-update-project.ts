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
        // A project edit changes name/eventDate, which are cached in two
        // places: the overview aggregate (what the header renders) and the
        // projects-list query (GET /api/projects, used to look up the single
        // project's id). Invalidate both, or one of them serves stale data.
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
