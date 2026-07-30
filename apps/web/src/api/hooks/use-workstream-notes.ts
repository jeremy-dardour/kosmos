import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';

import type { dtos } from '@/types/openapi';

export type NoteEntry = dtos['NoteDto'];
export type CreateNoteInput = dtos['CreateNoteDto'];
export type UpdateNoteInput = dtos['UpdateNoteDto'];

function notesQueryOptions(workstreamId: string) {
  return $api.queryOptions('get', '/api/workstreams/{workstreamId}/notes', {
    params: { path: { workstreamId } },
  });
}

function useInvalidateNotes(workstreamId: string) {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({
      queryKey: notesQueryOptions(workstreamId).queryKey,
    });
  };
}

export function useWorkstreamNotes(workstreamId: string | undefined) {
  return $api.useQuery(
    'get',
    '/api/workstreams/{workstreamId}/notes',
    { params: { path: { workstreamId: workstreamId ?? '' } } },
    { enabled: Boolean(workstreamId) },
  );
}

export function useCreateNote(workstreamId: string) {
  const queryClient = useQueryClient();
  const invalidateNotes = useInvalidateNotes(workstreamId);

  return $api.useMutation(
    'post',
    '/api/steps/{stepId}/notes',
    { onSuccess: invalidateNotes },
    queryClient,
  );
}

export function useUpdateNote(workstreamId: string) {
  const queryClient = useQueryClient();
  const invalidateNotes = useInvalidateNotes(workstreamId);

  return $api.useMutation(
    'patch',
    '/api/notes/{id}',
    { onSuccess: invalidateNotes },
    queryClient,
  );
}

export function useDeleteNote(workstreamId: string) {
  const queryClient = useQueryClient();
  const invalidateNotes = useInvalidateNotes(workstreamId);

  return $api.useMutation(
    'delete',
    '/api/notes/{id}',
    { onSuccess: invalidateNotes },
    queryClient,
  );
}
