import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useInvalidateOverview } from '@/api/hooks/use-invalidate-overview';
import { useInvalidateMembers } from '@/api/hooks/use-project-members';

export function useTransferOwnership(projectId: string | undefined) {
  const queryClient = useQueryClient();
  const invalidateMembers = useInvalidateMembers(projectId);
  // Unlike plain membership changes, transfer also moves `ownerId` in the
  // overview aggregate, so it refreshes the overview on top of the members
  // pair.
  const invalidateOverview = useInvalidateOverview(projectId);

  return $api.useMutation(
    'post',
    '/api/projects/{id}/transfer-ownership',
    {
      onSuccess: async () => {
        await Promise.all([invalidateMembers(), invalidateOverview()]);
      },
    },
    queryClient,
  );
}
