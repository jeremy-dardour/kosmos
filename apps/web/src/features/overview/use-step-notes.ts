import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useCreateNote,
  useDeleteNote,
  useUpdateNote,
  useWorkstreamNotes,
} from '@/api/hooks/use-workstream-notes';
import { useAuthState } from '@/auth';
import { formatToApiError } from '@/errors/format-error';

import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

type Translate = ReturnType<typeof useTranslation>['t'];

export interface ThreadEntry {
  id: string;
  body: string;
  author: string;
  when: string;
  /** Authors may revise their own entries — but never on a frozen step. */
  isOwn: boolean;
}

export interface StepThread {
  entries: ThreadEntry[];
  isPending: boolean;
  isError: boolean;
  /** Problem Details `detail` of the last failed note mutation. */
  errorDetail: string | null;
  addNote: (body: string) => void;
  editNote: (noteId: string, body: string) => void;
  deleteNote: (noteId: string) => void;
}

const MINUTE_MS = 60_000;

function relativeTime(iso: string, now: Date, t: Translate): string {
  const minutes = Math.max(
    0,
    Math.round((now.getTime() - new Date(iso).getTime()) / MINUTE_MS),
  );
  if (minutes < 60) return t('overview.thread.minutesAgo', { count: minutes });

  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('overview.thread.hoursAgo', { count: hours });

  return t('overview.thread.daysAgo', { count: Math.round(hours / 24) });
}

/**
 * The API answers newest-first; entries written here go to the end regardless,
 * so a thread grows downwards while it is being read.
 */
function buildThread(
  notes: NoteEntry[],
  stepId: string,
  sessionNoteIds: string[],
  currentUserId: string | null,
  now: Date,
  t: Translate,
): ThreadEntry[] {
  const forStep = notes.filter((note) => note.stepId === stepId);
  const session = new Set(sessionNoteIds);

  const existing = forStep
    .filter((note) => !session.has(note.id))
    .map((note) => ({
      id: note.id,
      body: note.content,
      author: note.author?.name ?? t('overview.thread.unknownAuthor'),
      when: relativeTime(note.createdAt, now, t),
      isOwn: note.author?.id === currentUserId,
    }));

  const added = sessionNoteIds
    .map((id) => forStep.find((note) => note.id === id))
    .filter((note) => note !== undefined)
    .map((note) => ({
      id: note.id,
      body: note.content,
      author: t('overview.thread.you'),
      when: t('overview.thread.justNow'),
      isOwn: true,
    }));

  return [...existing, ...added];
}

/**
 * One Step's note thread: the on-demand workstream query narrowed to the step,
 * plus the three mutations, with authorship already resolved against the signed
 * in user. Both the step editor's notes block and the standalone note panel
 * read from here, so the authorship and ordering rules exist once.
 */
export function useStepNotes(
  workstreamId: string,
  stepId: string,
  projectId: string | undefined,
  now: Date,
): StepThread {
  const { t } = useTranslation();
  const authState = useAuthState();
  const notes = useWorkstreamNotes(workstreamId);
  const create = useCreateNote(workstreamId, projectId);
  const update = useUpdateNote(workstreamId);
  const remove = useDeleteNote(workstreamId, projectId);
  const [sessionNoteIds, setSessionNoteIds] = useState<string[]>([]);

  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : null;

  const entries = useMemo(
    () =>
      buildThread(
        notes.data ?? [],
        stepId,
        sessionNoteIds,
        currentUserId,
        now,
        t,
      ),
    [notes.data, stepId, sessionNoteIds, currentUserId, now, t],
  );

  const mutationError = create.error ?? update.error ?? remove.error;

  return {
    entries,
    isPending: notes.isPending,
    isError: notes.isError,
    errorDetail: mutationError
      ? (formatToApiError(mutationError)?.detail ??
        t('overview.notes.mutationError'))
      : null,

    addNote: (body) =>
      create.mutate(
        { params: { path: { stepId } }, body: { content: body } },
        {
          onSuccess: (created) =>
            setSessionNoteIds((ids) => [...ids, created.id]),
        },
      ),

    editNote: (noteId, body) =>
      update.mutate({
        params: { path: { id: noteId } },
        body: { content: body },
      }),

    deleteNote: (noteId) => remove.mutate({ params: { path: { id: noteId } } }),
  };
}
