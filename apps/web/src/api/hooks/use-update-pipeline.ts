import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { formatToApiError } from '@/errors/format-error';

import type { dtos } from '@/types/openapi';

export type UpdatePipelineInput = dtos['UpdatePipelineDto'];

export function useUpdatePipeline(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'put',
    '/api/workstreams/{id}/pipeline',
    {
      onSuccess: async () => {
        await invalidateOverview();
      },
      onError: async (error) => {
        const problemType = formatToApiError(error)?.problemType;
        if (problemType?.endsWith('/pipeline-stale')) {
          await invalidateOverview();
        }
      },
    },
    queryClient,
  );
}
