import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type UpdatePipelineInput = dtos['UpdatePipelineDto'];

export function useUpdatePipeline(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'put',
    '/api/workstreams/{id}/pipeline',
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
