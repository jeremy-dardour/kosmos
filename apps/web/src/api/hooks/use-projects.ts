import { $api } from '@/api/api-client';

import type { QueryClient } from '@tanstack/react-query';

const projectsQueryOptions = () => $api.queryOptions('get', '/api/projects');

export function useProjects() {
  return $api.useQuery('get', '/api/projects');
}

export async function fetchProjects(queryClient: QueryClient) {
  return queryClient.ensureQueryData(projectsQueryOptions());
}

export async function invalidateProjectsList(queryClient: QueryClient) {
  await queryClient.invalidateQueries({
    queryKey: projectsQueryOptions().queryKey,
  });
}
