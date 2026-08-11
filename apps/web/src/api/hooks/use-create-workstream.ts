import { useMutation, useQueryClient } from '@tanstack/react-query';

import { $fetch, throwApiFailure } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';

import type { dtos } from '@/types/openapi';

export type CreateWorkstreamInput = dtos['CreateWorkstreamDto'];

interface CreateWorkstreamVariables {
  params: { path: { projectId: string } };
  body: CreateWorkstreamInput;
}

export async function createWorkstream(
  projectId: string,
  input: CreateWorkstreamInput,
) {
  const result = await $fetch.POST('/api/projects/{projectId}/workstreams', {
    params: { path: { projectId } },
    body: input,
  });
  if (result.error) throwApiFailure(result.error);

  return result.data;
}

export function useCreateWorkstream(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateOverview = useInvalidateOverview(projectId);

  return useMutation(
    {
      mutationFn: ({ params, body }: CreateWorkstreamVariables) =>
        createWorkstream(params.path.projectId, body),
      onSuccess: invalidateOverview,
    },
    queryClient,
  );
}
