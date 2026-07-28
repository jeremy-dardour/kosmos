import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useToggleChecklistItem } from '@/api/hooks/use-toggle-checklist-item';
import { useUpdatePipeline } from '@/api/hooks/use-update-pipeline';
import { Button } from '@/components/ui/button';
import { NotesSection } from '@/features/overview/notes-section';
import { PipelineEditor } from '@/features/overview/pipeline-editor';
import { VerticalPipeline } from '@/features/overview/vertical-pipeline';

import type {
  ChecklistItem,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';

interface DetailPanelProperties {
  workstream: Workstream | null;
  projectId?: string;
  users: UserSummary[];
  usersById: ReadonlyMap<string, UserSummary>;
  onClose: () => void;
}

export const DetailPanel = ({
  workstream,
  projectId,
  users,
  usersById,
  onClose,
}: DetailPanelProperties) => {
  const { t } = useTranslation();
  const [editingWorkstreamId, setEditingWorkstreamId] = useState<string | null>(
    null,
  );
  const updatePipeline = useUpdatePipeline(projectId);
  const toggleChecklist = useToggleChecklistItem(projectId);

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
          isSaving={updatePipeline.isPending}
          onCancel={() => setEditingWorkstreamId(null)}
          onSave={(body) =>
            updatePipeline.mutate(
              { params: { path: { id: workstream.id } }, body },
              { onSuccess: () => setEditingWorkstreamId(null) },
            )
          }
        />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
          <VerticalPipeline
            steps={workstream.steps}
            usersById={usersById}
            pendingChecklistItemId={
              toggleChecklist.isPending
                ? toggleChecklist.variables.params.path.id
                : null
            }
            onToggleChecklist={toggleItem}
          />

          <NotesSection workstreamId={workstream.id} />
        </div>
      )}
    </aside>
  );
};
