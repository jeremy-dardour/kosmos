import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

import type { dtos } from '@/types/openapi';

export type AdvanceOutcome = dtos['StepOutcome'];

export function useAdvanceWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'post',
    '/api/workstreams/{id}/advance',
    { onSuccess: invalidateOverview },
    queryClient,
  );
}
