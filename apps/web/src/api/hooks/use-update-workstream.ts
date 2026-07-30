import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

import type { dtos } from '@/types/openapi';

export type UpdateWorkstreamInput = dtos['UpdateWorkstreamDto'];

export function useUpdateWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'patch',
    '/api/workstreams/{id}',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}
