import { $api } from '@/api/api-client';

/** V1 holds a single project; the overview needs its id before it can load. */
export function useProjects() {
  return $api.useQuery('get', '/api/projects');
}
