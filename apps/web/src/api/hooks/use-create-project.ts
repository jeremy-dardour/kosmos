import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { invalidateProjectsList } from '@/api/hooks/use-projects';

import type { dtos } from '@/types/openapi';

export type CreateProjectInput = dtos['CreateProjectDto'];

export function useCreateProject() {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'post',
    '/api/projects',
    { onSuccess: () => invalidateProjectsList(queryClient) },
    queryClient,
  );
}
