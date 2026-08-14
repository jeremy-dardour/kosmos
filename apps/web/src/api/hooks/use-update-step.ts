import { useMutation, useQueryClient } from '@tanstack/react-query';

import { $fetch, unwrapApiResult } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type UpdateStepInput = dtos['UpdateStepDto'];

interface UpdateStepVariables {
  params: { path: { id: string } };
  body: UpdateStepInput;
}

export async function updateStep(stepId: string, input: UpdateStepInput) {
  return unwrapApiResult(
    await $fetch.PATCH('/api/steps/{id}', {
      params: { path: { id: stepId } },
      body: input,
    }),
  );
}

export function useUpdateStep(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return useMutation(
    {
      mutationFn: ({ params, body }: UpdateStepVariables) =>
        updateStep(params.path.id, body),
      onSuccess: (step) => patchOverview({ type: 'step', step }),
    },
    queryClient,
  );
}
