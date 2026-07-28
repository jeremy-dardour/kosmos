import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type NoteEntry = dtos['NoteDto'];

export function useWorkstreamNotes(workstreamId: string | undefined) {
  return $api.useQuery(
    'get',
    '/api/workstreams/{workstreamId}/notes',
    { params: { path: { workstreamId: workstreamId ?? '' } } },
    { enabled: Boolean(workstreamId) },
  );
}
