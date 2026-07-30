import { MoreHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToggleChecklistItem } from '@/api/hooks/use-toggle-checklist-item';
import { useUpdateWorkstreamPipeline } from '@/api/hooks/use-update-workstream-pipeline';
import { useWorkstreamNotes } from '@/api/hooks/use-workstream-notes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatToApiError } from '@/errors/format-error';
import { PipelineEditor } from '@/features/overview/pipeline-editor';
import { VerticalPipeline } from '@/features/overview/vertical-pipeline';

import type {
  ChecklistItem,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

interface DetailPanelProperties {
  workstream: Workstream | null;
  projectId?: string;
  users: UserSummary[];
  usersById: ReadonlyMap<string, UserSummary>;
  onClose: () => void;
  onEdit: (workstream: Workstream) => void;
  onDelete: (workstream: Workstream) => void;
}

export const DetailPanel = ({
  workstream,
  projectId,
  users,
  usersById,
  onClose,
  onEdit,
  onDelete,
}: DetailPanelProperties) => {
  const { t } = useTranslation();
  const [editingWorkstreamId, setEditingWorkstreamId] = useState<string | null>(
    null,
  );
  const updatePipeline = useUpdateWorkstreamPipeline(projectId);
  const toggleChecklist = useToggleChecklistItem(projectId);
  const notes = useWorkstreamNotes(workstream?.id);
  const notesByStepId = new Map<string, NoteEntry[]>();
  const noteEntries = notes.data ?? [];
  for (const note of noteEntries) {
    const stepNotes = notesByStepId.get(note.stepId) ?? [];
    stepNotes.push(note);
    notesByStepId.set(note.stepId, stepNotes);
  }

  if (!workstream) {
    return (
      <aside
        aria-label={t('overview.detail.title')}
        className="hidden min-h-0 flex-col items-center justify-center rounded-lg border border-dashed bg-card/40 p-panel text-center lg:flex"
      >
        <p className="text-sm font-medium text-muted-foreground">
          {t('overview.detail.title')}
        </p>
        <p className="mt-1 max-w-[24ch] text-xs text-muted-foreground/70">
          {t('overview.detail.description')}
        </p>
      </aside>
    );
  }

  const isEditing = editingWorkstreamId === workstream.id;
  const toggleItem = (item: ChecklistItem, isDone: boolean) => {
    toggleChecklist.mutate({
      params: { path: { id: item.id } },
      body: { done: isDone },
    });
  };

  return (
    <aside
      aria-label={workstream.name}
      className="hidden min-h-0 flex-col rounded-lg border bg-card lg:flex"
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span aria-hidden className="text-lg leading-none">
          {workstream.icon}
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {workstream.name}
        </h2>
        {!isEditing && workstream.lifecycle !== 'complete' && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setEditingWorkstreamId(workstream.id)}
          >
            {t('overview.editor.edit')}
          </Button>
        )}
        {!isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('overview.manage.moreActions', {
                    name: workstream.name,
                  })}
                />
              }
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(workstream)}>
                {t('overview.manage.editDetails')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(workstream)}
              >
                {t('overview.manage.deleteWorkstream')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('overview.detail.close')}
        >
          ✕
        </button>
      </div>

      {isEditing ? (
        <PipelineEditor
          key={`${workstream.id}-${workstream.updatedAt}`}
          workstream={workstream}
          users={users}
          notesByStepId={notesByStepId}
          notesPending={notes.isPending}
          notesError={notes.isError}
          isSaving={updatePipeline.isPending}
          onCancel={() => setEditingWorkstreamId(null)}
          onSave={(body) =>
            updatePipeline.mutate(
              { params: { path: { id: workstream.id } }, body },
              {
                onSuccess: () => setEditingWorkstreamId(null),
                onError: (error) => {
                  if (
                    formatToApiError(error)?.problemType?.endsWith(
                      '/pipeline-stale',
                    )
                  ) {
                    setEditingWorkstreamId(null);
                  }
                },
              },
            )
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <VerticalPipeline
            steps={workstream.steps}
            workstreamId={workstream.id}
            usersById={usersById}
            notesByStepId={notesByStepId}
            notesPending={notes.isPending}
            notesError={notes.isError}
            pendingChecklistItemId={
              toggleChecklist.isPending
                ? toggleChecklist.variables.params.path.id
                : null
            }
            onToggleChecklist={toggleItem}
          />
        </div>
      )}
    </aside>
  );
};
