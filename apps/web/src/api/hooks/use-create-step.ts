import { useMutation, useQueryClient } from '@tanstack/react-query';

import { $fetch, throwApiFailure } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type CreateStepInput = dtos['CreateStepDto'];

interface CreateStepVariables {
  params: { path: { id: string } };
  body: CreateStepInput;
}

export async function createStep(workstreamId: string, input: CreateStepInput) {
  const result = await $fetch.POST('/api/workstreams/{id}/steps', {
    params: { path: { id: workstreamId } },
    body: input,
  });
  if (result.error) throwApiFailure(result.error);

  return result.data;
}

export function useCreateStep(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return useMutation(
    {
      mutationFn: ({ params, body }: CreateStepVariables) =>
        createStep(params.path.id, body),
      onSuccess: (workstream) =>
        patchOverview({ type: 'workstream', workstream }),
    },
    queryClient,
  );
}
