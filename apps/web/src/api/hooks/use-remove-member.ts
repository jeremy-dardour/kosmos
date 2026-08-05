import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateMembers } from '@/api/hooks/use-project-members';

export function useRemoveMember(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateMembers = useInvalidateMembers(projectId);

  return $api.useMutation(
    'delete',
    '/api/projects/{projectId}/members/{memberId}',
    { onSuccess: invalidateMembers },
    queryClient,
  );
}
