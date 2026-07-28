import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type Project = dtos['ProjectDto'];
export type Overview = dtos['OverviewDto'];
export type Workstream = dtos['OverviewWorkstreamDto'];
export type Step = dtos['StepDto'];
export type StepStatus = dtos['StepStatus'];
export type ChecklistItem = dtos['ChecklistItemDto'];
export type Group = dtos['GroupDto'];
export type UserSummary = dtos['UserSummaryDto'];

/** The whole overview aggregate in one request; idle until the id is known. */
export function useOverview(projectId: string | undefined) {
  return $api.useQuery(
    'get',
    '/api/projects/{projectId}/overview',
    { params: { path: { projectId: projectId ?? '' } } },
    { enabled: Boolean(projectId) },
  );
}
