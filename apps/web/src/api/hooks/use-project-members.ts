import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { $api } from '@/api/api-client';
import { invalidateProjectsList } from '@/api/hooks/use-projects';

import type { dtos } from '@/types/openapi';

export type Member = dtos['MemberDto'];

export const MEMBERS_NOT_FOUND_STATUS = 404;

/** The single home of the members query key — callers never rebuild it. */
export function projectMembersQueryOptions(projectId: string) {
  return $api.queryOptions('get', '/api/projects/{projectId}/members', {
    params: { path: { projectId } },
  });
}

/**
 * What a membership change refreshes, in one home: the members list and the
 * projects list (leaving removes the project from it). The overview stays
 * untouched — its users directory lists referenced owners, which membership
 * changes don't alter.
 */
export function useInvalidateMembers(projectId: string | undefined) {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: projectMembersQueryOptions(projectId ?? '').queryKey,
      }),
      invalidateProjectsList(queryClient),
    ]);
  }, [projectId, queryClient]);
}

/** A project's member rows, pending invites included; idle until the id is known. */
export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    ...projectMembersQueryOptions(projectId ?? ''),
    enabled: Boolean(projectId),
    // 404 means access was lost while the dialog was open (removed, or the
    // project was deleted) — the dialog handles it; the global error dialog
    // stays quiet.
    meta: { localErrorStatuses: [MEMBERS_NOT_FOUND_STATUS] },
  });
}
