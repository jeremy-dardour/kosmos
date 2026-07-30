import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { formatToApiError } from '@/errors/format-error';

import type { dtos } from '@/types/openapi';

export type UpdateWorkstreamPipelineInput = dtos['UpdatePipelineDto'];

// Replaces a workstream's ordered step list atomically (PUT), with optimistic
// concurrency — distinct from `useUpdateWorkstream`, which PATCHes the
// workstream's own fields (name, icon, group, owner).
export function useUpdateWorkstreamPipeline(projectId: string | undefined) {
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
