import {
  ChevronDownIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NoteThread } from '@/features/overview/note-thread';
import { isStepEditable } from '@/features/overview/step-mutability';
import { useStepNotes } from '@/features/overview/use-step-notes';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';

interface NotesBlockProperties {
  workstreamId: string;
  step: Step;
  projectId: string | undefined;
  now: Date;
}

/**
 * A frozen Step still takes new notes — the one thing the pipeline rules keep
 * open on a past step — so this block never disappears with the rest of the
 * editing affordances.
 */
export const NotesBlock = ({
  workstreamId,
  step,
  projectId,
  now,
}: NotesBlockProperties) => {
  const { t } = useTranslation();
  const thread = useStepNotes(workstreamId, step.id, projectId, now);
  const [isOpen, setIsOpen] = useState(true);
  const stepName = step.name || t('overview.pipeline.untitled');
  const latest = thread.entries.at(-1);

  if (!latest && !isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <MessageSquarePlusIcon aria-hidden className="size-3" />
        {t('overview.stepEditor.addNote')}
      </button>
    );
  }

  return (
    <div className="mt-1.5">
      {latest && (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-label={t(
            isOpen
              ? 'overview.notes.hideForStep'
              : 'overview.notes.showForStep',
            { name: stepName },
          )}
          onClick={() => setIsOpen((open) => !open)}
          className="flex w-full items-center gap-1.5 rounded-md bg-muted/55 px-2 py-1 text-left text-[11px] hover:bg-muted"
        >
          <MessageSquareIcon
            aria-hidden
            className="size-3 shrink-0 text-muted-foreground"
          />
          <span className="shrink-0 font-medium">
            {t('overview.thread.title')}
            <span className="ml-1 tabular-nums">{thread.entries.length}</span>
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {latest.body}
          </span>
          <span className="shrink-0 text-muted-foreground/70">
            {latest.author} · {latest.when}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-transform',
              isOpen && 'rotate-180',
            )}
          />
        </button>
      )}

      {isOpen && (
        <NoteThread
          stepName={stepName}
          thread={thread}
          isAppendOnly={!isStepEditable(step)}
          onEscape={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
