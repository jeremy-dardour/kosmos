import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type AdvanceOutcome = dtos['StepOutcome'];

export function useAdvanceWorkstream(projectId: string | undefined) {
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
