import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { useOverviewCache } from '@/api/overview-cache';

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

/**
 * Same command, committed the inline overview's way. It stays a second export
 * only while the pre-inline card still needs the invalidating variant above.
 */
export function useAdvanceWorkstreamInline(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'post',
    '/api/workstreams/{id}/advance',
    {
      onSuccess: (workstream) =>
        patchOverview({ type: 'workstream', workstream }),
    },
    queryClient,
  );
}
