import { useTranslation } from 'react-i18next';

import { ChecklistCard } from '@/features/overview/checklist-card';
import { NotesSection } from '@/features/overview/notes-section';
import { VerticalPipeline } from '@/features/overview/vertical-pipeline';

import type { UserSummary, Workstream } from '@/api/hooks/use-overview';

interface DetailPanelProperties {
  workstream: Workstream | null;
  usersById: ReadonlyMap<string, UserSummary>;
  onClose: () => void;
}

export const DetailPanel = ({
  workstream,
  usersById,
  onClose,
}: DetailPanelProperties) => {
  const { t } = useTranslation();

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

  const currentStep = workstream.steps.find((s) => s.status === 'in_progress');

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
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={t('overview.detail.close')}
        >
          ✕
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4">
        <VerticalPipeline steps={workstream.steps} usersById={usersById} />

        {currentStep && currentStep.checklistItems.length > 0 && (
          <ChecklistCard items={currentStep.checklistItems} />
        )}

        <NotesSection workstreamId={workstream.id} />
      </div>
    </aside>
  );
};
