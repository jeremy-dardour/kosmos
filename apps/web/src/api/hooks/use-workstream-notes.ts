import { useQueryClient } from '@tanstack/react-query';

import { $api } from '@/api/api-client';
import { useOverviewCache } from '@/api/overview-cache';

import type { dtos } from '@/types/openapi';
import type { QueryClient } from '@tanstack/react-query';

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

/**
 * Note bodies stay on demand, so a deletion only carries the note id — the
 * step it belonged to is read back from the still-cached thread.
 */
function findCachedNoteStepId(
  queryClient: QueryClient,
  workstreamId: string,
  noteId: string,
): string | undefined {
  const notes = queryClient.getQueryData<NoteEntry[]>(
    notesQueryOptions(workstreamId).queryKey,
  );

  return notes?.find((note) => note.id === noteId)?.stepId;
}

export function useWorkstreamNotes(workstreamId: string | undefined) {
  return $api.useQuery(
    'get',
    '/api/workstreams/{workstreamId}/notes',
    { params: { path: { workstreamId: workstreamId ?? '' } } },
    { enabled: Boolean(workstreamId) },
  );
}

/** `projectId` routes the note-count delta into the cached overview. */
export function useCreateNote(
  workstreamId: string,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  const invalidateNotes = useInvalidateNotes(workstreamId);
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'post',
    '/api/steps/{stepId}/notes',
    {
      onSuccess: async (note) => {
        patchOverview({ type: 'note-count', stepId: note.stepId, delta: 1 });
        await invalidateNotes();
      },
    },
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

export function useDeleteNote(
  workstreamId: string,
  projectId: string | undefined,
) {
  const queryClient = useQueryClient();
  const invalidateNotes = useInvalidateNotes(workstreamId);
  const patchOverview = useOverviewCache(projectId);

  return $api.useMutation(
    'delete',
    '/api/notes/{id}',
    {
      onSuccess: async (_data, variables) => {
        const stepId = findCachedNoteStepId(
          queryClient,
          workstreamId,
          variables.params.path.id,
        );
        if (stepId) {
          patchOverview({ type: 'note-count', stepId, delta: -1 });
        }
        await invalidateNotes();
      },
    },
    queryClient,
  );
}
