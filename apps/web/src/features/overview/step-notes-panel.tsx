import { MessageSquareIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { NoteThread } from '@/features/overview/note-thread';
import { isStepEditable } from '@/features/overview/step-mutability';
import { useFocusOnOpen } from '@/features/overview/use-focus-on-open';
import { useStepNotes } from '@/features/overview/use-step-notes';

import type { Step } from '@/api/hooks/use-overview';

interface StepNotesPanelProperties {
  workstreamId: string;
  step: Step;
  projectId: string | undefined;
  now: Date;
  onClose: () => void;
}

/**
 * The thread for whichever step's marker was clicked, anchored under that dot.
 * Notes belong to the pipeline rather than to a card footer, so a past step's
 * thread stays reachable without opening its editor.
 */
export const StepNotesPanel = ({
  workstreamId,
  step,
  projectId,
  now,
  onClose,
}: StepNotesPanelProperties) => {
  const { t } = useTranslation();
  const panelRef = useFocusOnOpen<HTMLElement>();
  const thread = useStepNotes(workstreamId, step.id, projectId, now);
  const stepName = step.name || t('overview.pipeline.untitled');

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label={t('overview.notesPanel.label', { name: stepName })}
      className="rounded-lg border bg-muted/20 p-2.5 outline-hidden focus-visible:ring-2 focus-visible:ring-step-in-progress/50"
    >
      <div className="flex items-center gap-1.5 text-[11px]">
        <MessageSquareIcon
          aria-hidden
          className="size-3 shrink-0 text-muted-foreground"
        />
        <span className="min-w-0 flex-1 truncate font-medium">{stepName}</span>
        <span className="shrink-0 text-muted-foreground">
          {t('overview.thread.title')}
          <span className="ml-1 tabular-nums">{thread.entries.length}</span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.notesPanel.close', { name: stepName })}
          title={t('overview.notesPanel.close', { name: stepName })}
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>

      <NoteThread
        stepName={stepName}
        thread={thread}
        isAppendOnly={!isStepEditable(step)}
        onEscape={onClose}
      />
    </section>
  );
};
