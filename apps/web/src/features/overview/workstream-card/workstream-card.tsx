import { Trash2Icon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDeleteWorkstream } from '@/api/hooks/use-delete-workstream';
import { useUpdateChecklistItem } from '@/api/hooks/use-update-checklist-item';
import { useUpdateWorkstream } from '@/api/hooks/use-update-workstream';
import { Button } from '@/components/ui/button';
import { AdvanceControl } from '@/features/overview/advance-control';
import { canAppendStep } from '@/features/overview/can-append-step';
import { ClickToEdit } from '@/features/overview/click-to-edit';
import { ConfirmDialog } from '@/features/overview/confirm-dialog';
import { DotCaret } from '@/features/overview/dot-caret';
import { GhostStep } from '@/features/overview/ghost-step';
import { HOVER_REVEAL } from '@/features/overview/hover-reveal';
import { IconPicker } from '@/features/overview/icon-picker';
import { isInsideCard } from '@/features/overview/is-inside-card';
import { OwnerPicker } from '@/features/overview/owner-picker';
import { PipelineRow } from '@/features/overview/pipeline-row/pipeline-row';
import { StepEditor } from '@/features/overview/step-editor/step-editor';
import { StepNotesPanel } from '@/features/overview/step-notes-panel';
import { DeadlineBadge } from '@/features/overview/workstream-card/deadline-badge';
import { GroupChip } from '@/features/overview/workstream-card/group-chip';
import { LifecycleBadges } from '@/features/overview/workstream-card/lifecycle-badges';
import { cn } from '@/lib/utils';

import type {
  Group,
  Step,
  UserSummary,
  Workstream,
} from '@/api/hooks/use-overview';
import type { GhostStepDraft } from '@/features/overview/ghost-step';
import type { MouseEvent, ReactNode } from 'react';

interface WorkstreamCardProperties {
  workstream: Workstream;
  groups: Group[];
  users: UserSummary[];
  /** Built once by the list, per the one-derived-lookup rule. */
  usersById: Map<string, UserSummary>;
  projectId: string | undefined;
  now: Date;
  openStepId: string | null;
  openNotesStepId: string | null;
  /** Set while this card holds the overview's unsaved step. */
  ghost?: GhostStepDraft;
  /** Pointed at from elsewhere — a widget deadline row under the cursor. */
  isHighlighted?: boolean;
  /** `null` closes the step editor; an id opens it on that step. */
  onOpenStep: (stepId: string | null) => void;
  /** `null` closes the note panel; an id opens it on that step. */
  onOpenNotes: (stepId: string | null) => void;
  onCloseEditors: () => void;
  onInsertStep: (position: number) => void;
  dragHandle?: ReactNode;
}

/**
 * One workstream's inline card: every part of it is a live field, and every
 * change commits immediately through the cache seam — no edit mode, no Save
 * button.
 */
export const WorkstreamCard = ({
  workstream,
  groups,
  users,
  usersById,
  projectId,
  now,
  openStepId,
  openNotesStepId,
  ghost,
  isHighlighted = false,
  onOpenStep,
  onOpenNotes,
  onCloseEditors,
  onInsertStep,
  dragHandle,
}: WorkstreamCardProperties) => {
  const { t } = useTranslation();
  const updateWorkstream = useUpdateWorkstream(projectId);
  const updateChecklistItem = useUpdateChecklistItem(projectId);
  const deleteWorkstream = useDeleteWorkstream(projectId);
  const cardRef = useRef<HTMLElement>(null);
  // A panel unmounts when it closes, so the pipeline-row button that opened it
  // has to be remembered to take focus back. Reading it off the click covers
  // pointer and keyboard activation alike, with no plumbing through
  // `PipelineRow`.
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const rememberOpener = (event: MouseEvent<HTMLElement>) => {
    openerRef.current =
      event.target instanceof Element ? event.target.closest('button') : null;
  };

  const returnFocusToOpener = () => openerRef.current?.focus();

  const isAnyPanelOpen =
    openStepId !== null || openNotesStepId !== null || ghost !== undefined;

  useEffect(() => {
    if (!isAnyPanelOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!isInsideCard(event.target, cardRef.current)) {
        onCloseEditors();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isAnyPanelOpen, onCloseEditors]);

  const isLive = workstream.lifecycle !== 'complete';
  const deadlineStep = deadlineStepOf(workstream);
  const openedStep =
    workstream.steps.find((step) => step.id === openStepId) ?? null;
  // A step's own editor already carries its thread, so the marker panel would
  // only repeat it (handoff A10).
  const notesStep =
    workstream.steps.find(
      (step) => step.id === openNotesStepId && step.id !== openStepId,
    ) ?? null;
  const stepIds = workstream.steps.map((step) => step.id);
  const hasAppendColumn = canAppendStep(workstream.lifecycle);

  const commit = (body: {
    name?: string;
    icon?: string;
    groupId?: string | null;
    ownerId?: string | null;
  }) => {
    updateWorkstream.mutate({
      params: { path: { id: workstream.id } },
      body,
    });
  };

  return (
    <article
      ref={cardRef}
      data-workstream-id={workstream.id}
      data-highlighted={isHighlighted ? '' : undefined}
      className={cn(
        'group/card rounded-lg border p-4 transition-colors',
        cardFrameClass(isLive, isAnyPanelOpen, isHighlighted),
      )}
    >
      {/* The dimming lives on the header rather than the card root, because a
          parent `opacity` cannot be undone by the parts that must stay bright. */}
      <div
        className={cn(
          'flex flex-wrap items-center gap-2',
          !isLive && 'opacity-65',
        )}
      >
        {dragHandle}
        <IconPicker
          value={workstream.icon}
          label={t('overview.card.changeIcon', { name: workstream.name })}
          className="w-8 shrink-0 text-center text-base leading-none"
          onSelect={(icon) => commit({ icon })}
        />
        <ClickToEdit
          value={workstream.name}
          label={t('overview.card.renameLabel', { name: workstream.name })}
          placeholder={t('overview.pipeline.untitled')}
          className={cn(
            'text-sm',
            isLive
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground',
          )}
          onCommit={(name) => commit({ name })}
        />
        <GroupChip
          groups={groups}
          groupId={workstream.groupId ?? null}
          label={t('overview.card.changeGroup', { name: workstream.name })}
          onSelect={(groupId) => commit({ groupId })}
        />
        <LifecycleBadges workstream={workstream} />
        <AdvanceControl workstream={workstream} projectId={projectId} />

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {deadlineStep?.deadline && (
            <DeadlineBadge step={deadlineStep} now={now} />
          )}
          <OwnerPicker
            users={users}
            owner={
              workstream.ownerId
                ? (usersById.get(workstream.ownerId) ?? null)
                : null
            }
            label={t('overview.card.changeOwner', { name: workstream.name })}
            clearLabel={t('overview.card.unassigned')}
            onSelect={(ownerId) => commit({ ownerId })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('overview.card.delete', { name: workstream.name })}
            title={t('overview.card.delete', { name: workstream.name })}
            className={cn(
              HOVER_REVEAL,
              'text-muted-foreground/60 hover:text-destructive group-hover/card:opacity-100',
            )}
            onClick={() => setIsConfirmingDelete(true)}
          >
            <Trash2Icon />
          </Button>
        </div>
      </div>

      <div className="mt-3" onClickCapture={rememberOpener}>
        <PipelineRow
          steps={workstream.steps}
          currentStepId={workstream.currentStepId ?? null}
          lifecycle={workstream.lifecycle}
          usersById={usersById}
          now={now}
          openStepId={openStepId}
          openNotesStepId={openNotesStepId}
          onStepToggle={(stepId) =>
            onOpenStep(stepId === openStepId ? null : stepId)
          }
          onNoteMarkerToggle={(stepId) =>
            onOpenNotes(stepId === openNotesStepId ? null : stepId)
          }
          onInsertStep={onInsertStep}
          onChecklistItemToggle={(itemId, isDone) =>
            updateChecklistItem.mutate({
              params: { path: { id: itemId } },
              body: { done: isDone },
            })
          }
        />
      </div>

      {ghost && (
        <GhostStep
          ghost={{
            ...ghost,
            onDiscard: () => {
              ghost.onDiscard();
              returnFocusToOpener();
            },
          }}
        />
      )}

      {openedStep && (
        <>
          <DotCaret
            stepIds={stepIds}
            targetStepId={openedStep.id}
            hasAppendColumn={hasAppendColumn}
          />
          <StepEditor
            key={openedStep.id}
            workstream={workstream}
            step={openedStep}
            users={users}
            usersById={usersById}
            projectId={projectId}
            now={now}
            onOpenStep={(stepId) => {
              if (stepId === null) returnFocusToOpener();
              onOpenStep(stepId);
            }}
          />
        </>
      )}

      {notesStep && (
        <>
          <DotCaret
            stepIds={stepIds}
            targetStepId={notesStep.id}
            hasAppendColumn={hasAppendColumn}
          />
          <StepNotesPanel
            key={notesStep.id}
            workstreamId={workstream.id}
            step={notesStep}
            projectId={projectId}
            now={now}
            onClose={() => {
              returnFocusToOpener();
              onOpenNotes(null);
            }}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={isConfirmingDelete}
        onOpenChange={setIsConfirmingDelete}
        title={t('overview.card.deleteTitle', { name: workstream.name })}
        description={t('overview.card.deleteDescription')}
        confirmLabel={t('overview.card.deleteConfirm')}
        cancelLabel={t('overview.manage.form.cancel')}
        isPending={deleteWorkstream.isPending}
        onConfirm={() =>
          deleteWorkstream.mutate(
            { params: { path: { id: workstream.id } } },
            // The card only goes once the refetch lands; the dialog should not
            // sit over the list until then.
            { onSuccess: () => setIsConfirmingDelete(false) },
          )
        }
      />
    </article>
  );
};

/**
 * The frame follows lifecycle: live work is a bordered card with a surface;
 * finished work keeps only a light frame so it stays findable in the
 * Completed section without competing. Anything open restores the full frame,
 * and a highlight ring rides on top of whichever frame is in play.
 */
function cardFrameClass(
  isLive: boolean,
  isOpen: boolean,
  isHighlighted: boolean,
): string {
  return cn(
    isOpen && 'border-step-in-progress/60 bg-card shadow-xs',
    !isOpen &&
      (isLive
        ? 'border-border bg-card shadow-xs hover:border-muted-foreground/30'
        : 'border-border/50 bg-transparent hover:bg-card/60'),
    isHighlighted && 'ring-2 ring-step-in-progress/50',
  );
}

function deadlineStepOf(workstream: Workstream): Step | null {
  if (!workstream.nearestDeadlineStepId) return null;
  return (
    workstream.steps.find(
      (step) => step.id === workstream.nearestDeadlineStepId,
    ) ?? null
  );
}
