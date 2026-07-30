import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

import type { dtos } from '@/types/openapi';

export type UpdateGroupInput = dtos['UpdateGroupDto'];

export function useUpdateGroup(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'patch',
    '/api/groups/{id}',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}
