import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type AdvanceOutcome = dtos['StepOutcome'];

export function useAdvanceWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'post',
    '/api/workstreams/{id}/advance',
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
