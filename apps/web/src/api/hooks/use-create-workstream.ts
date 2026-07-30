import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

import type { dtos } from '@/types/openapi';

export type CreateWorkstreamInput = dtos['CreateWorkstreamDto'];

export function useCreateWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'post',
    '/api/projects/{projectId}/workstreams',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}
