import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type CreateProjectInput = dtos['CreateProjectDto'];

export function useCreateProject() {
  const queryClient = useQueryClient();

  return $api.useMutation(
    'post',
    '/api/projects',
    {
      onSuccess: async () => {
        const projects = $api.queryOptions('get', '/api/projects');
        await queryClient.invalidateQueries({ queryKey: projects.queryKey });
      },
    },
    queryClient,
  );
}
