import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateMembers } from '@/api/hooks/use-project-members';

import type { dtos } from '@/types/openapi';

export type AddMemberInput = dtos['AddMemberDto'];

export function useAddMember(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateMembers = useInvalidateMembers(projectId);

  return $api.useMutation(
    'post',
    '/api/projects/{projectId}/members',
    { onSuccess: invalidateMembers },
    queryClient,
  );
}
