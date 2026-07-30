import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

export function useDeleteWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'delete',
    '/api/workstreams/{id}',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}
