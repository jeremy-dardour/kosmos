import {
  ChevronDownIcon,
  ChevronRightIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useCreateNote,
  useDeleteNote,
  useUpdateNote,
} from '@/api/hooks/use-workstream-notes';
import { useAuthState } from '@/auth';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatToApiError } from '@/errors/format-error';
import { cn } from '@/lib/utils';

import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

interface StepNotesProperties {
  workstreamId: string;
  stepId?: string;
  stepName: string;
  notes: NoteEntry[];
  isPending?: boolean;
  isError?: boolean;
}

type NoteAction =
  | { type: 'idle' }
  | { type: 'creating'; draft: string }
  | { type: 'editing'; noteId: string; draft: string }
  | { type: 'deleting'; note: NoteEntry };

function authorInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.at(0)?.toUpperCase() ?? '')
    .join('');
}

const URL_REGEX = /https?:\/\/[^\s<>)"]+/g;
const TRAILING_PUNCT = /[.,;:!?]+$/;

function trimUrl(raw: string): { href: string; trailing: string } {
  const match = TRAILING_PUNCT.exec(raw);
  if (!match) return { href: raw, trailing: '' };
  return { href: raw.slice(0, match.index), trailing: match[0] };
}

export function NoteContent({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  const rawUrls = text.match(URL_REGEX);

  if (!rawUrls) return <>{text}</>;

  return (
    <>
      {parts.map((part, index) => {
        const raw = rawUrls.at(index);
        const url = raw ? trimUrl(raw) : null;
        return (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- stable split output
          <span key={index}>
            {part}
            {url && (
              <>
                <a
                  href={url.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-step-in-progress underline underline-offset-2 hover:text-step-in-progress/80"
                >
                  {url.href}
                </a>
                {url.trailing}
              </>
            )}
          </span>
        );
      })}
    </>
  );
}

export const StepNotes = ({
  workstreamId,
  stepId,
  stepName,
  notes,
  isPending = false,
  isError = false,
}: StepNotesProperties) => {
  const { t } = useTranslation();
  const authState = useAuthState();
  const currentUserId =
    authState.status === 'authenticated' ? authState.user.id : null;
  const createNote = useCreateNote(workstreamId);
  const updateNote = useUpdateNote(workstreamId);
  const deleteNote = useDeleteNote(workstreamId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [action, setAction] = useState<NoteAction>({ type: 'idle' });

  const mutationError =
    createNote.error ?? updateNote.error ?? deleteNote.error;
  const formattedError = mutationError ? formatToApiError(mutationError) : null;
  const resetMutations = () => {
    createNote.reset();
    updateNote.reset();
    deleteNote.reset();
  };

  const startWriting = () => {
    if (!stepId) return;
    resetMutations();
    setIsExpanded(true);
    setAction({ type: 'creating', draft: '' });
  };

  const saveNewNote = () => {
    if (!stepId || action.type !== 'creating' || !action.draft.trim()) return;
    createNote.mutate(
      {
        params: { path: { stepId } },
        body: { content: action.draft },
      },
      {
        onSuccess: () => setAction({ type: 'idle' }),
      },
    );
  };

  const saveEdit = () => {
    if (action.type !== 'editing' || !action.draft.trim()) return;
    updateNote.mutate(
      {
        params: { path: { id: action.noteId } },
        body: { content: action.draft },
      },
      {
        onSuccess: () => setAction({ type: 'idle' }),
      },
    );
  };

  return (
    <div className="mt-1.5 rounded-lg border bg-card">
      <div className="flex min-h-8 items-center gap-1 px-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
          aria-expanded={isExpanded}
          aria-label={t(
            isExpanded
              ? 'overview.notes.hideForStep'
              : 'overview.notes.showForStep',
            { name: stepName },
          )}
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded ? (
            <ChevronDownIcon className="size-3" />
          ) : (
            <ChevronRightIcon className="size-3" />
          )}
          <span>{t('overview.detail.notes')}</span>
          <span className="font-normal tabular-nums">{notes.length}</span>
        </button>
        <span className="text-[10px] text-muted-foreground">
          {t(
            stepId
              ? 'overview.notes.savesIndependently'
              : 'overview.notes.savePipelineFirst',
          )}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.notes.addToStep', { name: stepName })}
          disabled={!stepId}
          onClick={startWriting}
        >
          <PlusIcon />
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-2 border-t px-2 py-2">
          {isError && (
            <p className="text-xs text-destructive">
              {t('overview.detail.notesError')}
            </p>
          )}
          {isPending && (
            <p className="text-xs text-muted-foreground">
              {t('overview.notes.loading')}
            </p>
          )}
          {!isPending &&
            !isError &&
            notes.length === 0 &&
            action.type !== 'creating' && (
              <p className="text-xs text-muted-foreground">
                {t('overview.notes.emptyForStep')}
              </p>
            )}

          {notes.map((note) => {
            const isOwn = note.author?.id === currentUserId;
            const isEditing =
              action.type === 'editing' && action.noteId === note.id;
            const wasEdited =
              new Date(note.updatedAt).getTime() >
              new Date(note.createdAt).getTime();

            return (
              <div key={note.id} className="group rounded-md py-1 text-xs">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span
                    className={cn(
                      'font-medium',
                      note.author ? 'text-foreground' : 'italic',
                    )}
                  >
                    {note.author
                      ? authorInitials(note.author.name)
                      : t('overview.detail.unknownAuthor')}
                  </span>
                  {wasEdited && (
                    <span>
                      ·{' '}
                      {t('overview.notes.edited', {
                        date: new Date(note.updatedAt).toLocaleString(),
                      })}
                    </span>
                  )}
                  {isOwn && !isEditing && (
                    <span className="ml-auto flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('overview.notes.editNote', {
                          name: stepName,
                        })}
                        onClick={() => {
                          resetMutations();
                          setAction({
                            type: 'editing',
                            noteId: note.id,
                            draft: note.content,
                          });
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={t('overview.notes.deleteNote', {
                          name: stepName,
                        })}
                        onClick={() => {
                          resetMutations();
                          setAction({ type: 'deleting', note });
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </span>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-1 space-y-1.5">
                    <Textarea
                      value={action.type === 'editing' ? action.draft : ''}
                      maxLength={5000}
                      aria-label={t('overview.notes.editInput', {
                        name: stepName,
                      })}
                      onChange={(event) =>
                        setAction({
                          type: 'editing',
                          noteId: note.id,
                          draft: event.target.value,
                        })
                      }
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        disabled={updateNote.isPending}
                        onClick={() => {
                          setAction({ type: 'idle' });
                          updateNote.reset();
                        }}
                      >
                        {t('overview.notes.cancel')}
                      </Button>
                      <Button
                        type="button"
                        size="xs"
                        disabled={
                          action.type !== 'editing' ||
                          !action.draft.trim() ||
                          updateNote.isPending
                        }
                        onClick={saveEdit}
                      >
                        {t(
                          updateNote.isPending
                            ? 'overview.notes.saving'
                            : 'overview.notes.save',
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-0.5 whitespace-pre-wrap">
                    <NoteContent text={note.content} />
                  </p>
                )}
              </div>
            );
          })}

          {action.type === 'creating' && (
            <div className="rounded-md border bg-muted/15 p-2">
              <Textarea
                value={action.draft}
                maxLength={5000}
                aria-label={t('overview.notes.newInput', { name: stepName })}
                placeholder={t('overview.notes.placeholder', {
                  name: stepName,
                })}
                onChange={(event) =>
                  setAction({ type: 'creating', draft: event.target.value })
                }
              />
              <div className="mt-1 flex justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={createNote.isPending}
                  onClick={() => {
                    setAction({ type: 'idle' });
                    createNote.reset();
                  }}
                >
                  {t('overview.notes.cancel')}
                </Button>
                <Button
                  type="button"
                  size="xs"
                  disabled={!action.draft.trim() || createNote.isPending}
                  onClick={saveNewNote}
                >
                  {t(
                    createNote.isPending
                      ? 'overview.notes.saving'
                      : 'overview.notes.add',
                  )}
                </Button>
              </div>
            </div>
          )}

          {formattedError && (
            <p role="alert" className="text-xs text-destructive">
              {formattedError.detail ?? t('overview.notes.mutationError')}
            </p>
          )}
        </div>
      )}

      <Dialog
        open={action.type === 'deleting'}
        onOpenChange={(open) => {
          if (!open && !deleteNote.isPending) setAction({ type: 'idle' });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('overview.notes.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('overview.notes.deleteDescription', { name: stepName })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteNote.isPending}
              onClick={() => setAction({ type: 'idle' })}
            >
              {t('overview.notes.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteNote.isPending}
              onClick={() => {
                if (action.type !== 'deleting') return;
                deleteNote.mutate(
                  { params: { path: { id: action.note.id } } },
                  { onSuccess: () => setAction({ type: 'idle' }) },
                );
              }}
            >
              {t(
                deleteNote.isPending
                  ? 'overview.notes.deleting'
                  : 'overview.notes.delete',
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
