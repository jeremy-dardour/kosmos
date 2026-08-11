import { useMutation, useQueryClient } from '@tanstack/react-query';

import { $fetch, throwApiFailure } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';

export type CreateChecklistItemInput = dtos['CreateChecklistItemDto'];

interface CreateChecklistItemVariables {
  params: { path: { stepId: string } };
  body: CreateChecklistItemInput;
}

export async function createChecklistItem(
  stepId: string,
  input: CreateChecklistItemInput,
) {
  const result = await $fetch.POST('/api/steps/{stepId}/checklist-items', {
    params: { path: { stepId } },
    body: input,
  });
  if (result.error) throwApiFailure(result.error);

  return result.data;
}

export function useCreateChecklistItem(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const patchOverview = useOverviewCache(projectId);

  return useMutation(
    {
      mutationFn: ({ params, body }: CreateChecklistItemVariables) =>
        createChecklistItem(params.path.stepId, body),
      onSuccess: (checklistItem, variables) =>
        patchOverview({
          type: 'checklist-item-added',
          stepId: variables.params.path.stepId,
          checklistItem,
        }),
    },
    queryClient,
  );
}
