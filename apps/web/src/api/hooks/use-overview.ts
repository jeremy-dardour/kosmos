import { useQuery } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';
import type { QueryClient } from '@tanstack/react-query';

export type Project = dtos['ProjectDto'];
export type Overview = dtos['OverviewDto'];
export type Workstream = dtos['WorkstreamDto'];
export type WorkstreamLifecycle = dtos['WorkstreamLifecycle'];
export type Step = dtos['StepDto'];
export type StepStatus = dtos['StepStatus'];
export type ChecklistItem = dtos['ChecklistItemDto'];
export type Group = dtos['GroupDto'];
export type UserSummary = dtos['UserSummaryDto'];

export const OVERVIEW_NOT_FOUND_STATUS = 404;

/** The single home of the aggregate's query key — callers never rebuild it. */
export function overviewQueryOptions(projectId: string) {
  return $api.queryOptions('get', '/api/projects/{projectId}/overview', {
    params: { path: { projectId } },
  });
}

/**
 * Cache-first read for imperative callers (e.g. assistant functions): returns
 * the cached aggregate when present, fetching only when it is absent.
 */
export async function fetchOverview(
  queryClient: QueryClient,
  projectId: string,
) {
  return queryClient.ensureQueryData(overviewQueryOptions(projectId));
}

/**
 * Awaits the refetch, not just the invalidation: assistant write handlers
 * return only once their result is on screen and in the next turn's context.
 */
export async function refreshOverview(
  queryClient: QueryClient,
  projectId: string,
) {
  await queryClient.invalidateQueries({
    queryKey: overviewQueryOptions(projectId).queryKey,
  });
}

/** The whole overview aggregate in one request; idle until the id is known. */
export function useOverview(projectId: string | undefined) {
  return useQuery({
    ...overviewQueryOptions(projectId ?? ''),
    enabled: Boolean(projectId),
    // The page renders 404 itself as the "project not found" state
    // (non-member or deleted project) — the global error dialog stays quiet.
    meta: { localErrorStatuses: [OVERVIEW_NOT_FOUND_STATUS] },
  });
}
