import { $api } from '@/api/api-client';

export function useProjects() {
  return $api.useQuery('get', '/api/projects');
}
