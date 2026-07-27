import { $api } from '@/api/api-client';

/** The whole overview aggregate in one request; idle until the id is known. */
export function useOverview(projectId: string | undefined) {
  return $api.useQuery(
    'get',
    '/api/projects/{projectId}/overview',
    { params: { path: { projectId: projectId ?? '' } } },
    { enabled: Boolean(projectId) },
  );
}
