import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type UpdateStepInput = dtos['UpdateStepDto'];

export function useUpdateStep(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'patch',
    '/api/steps/{id}',
    { onSuccess: (step) => patchOverview({ type: 'step', step }) },
    queryClient,
  );
}
