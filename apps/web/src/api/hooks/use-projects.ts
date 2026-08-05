import { $api } from '@/api/api-client';

import type { QueryClient } from '@tanstack/react-query';

export function useProjects() {
  return $api.useQuery('get', '/api/projects');
}

/** The single home of the projects-list query key — callers never rebuild it. */
export async function invalidateProjectsList(
  queryClient: QueryClient,
): Promise<void> {
  const projects = $api.queryOptions('get', '/api/projects');
  await queryClient.invalidateQueries({ queryKey: projects.queryKey });
}
