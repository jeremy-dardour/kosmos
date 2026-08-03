import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListChecksIcon,
  MessageSquareIcon,
  MessageSquarePlusIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { useDeleteChecklistItem } from '@/api/hooks/use-delete-checklist-item';
import { useDeleteStep } from '@/api/hooks/use-delete-step';
import { useReorderSteps } from '@/api/hooks/use-reorder-steps';
import { useUpdateChecklistItem } from '@/api/hooks/use-update-checklist-item';
import { useUpdateStep } from '@/api/hooks/use-update-step';
import { Button } from '@/components/ui/button';
import { ClickToEdit } from '@/features/overview/click-to-edit';
import { DeadlineField } from '@/features/overview/deadline-field';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { HOVER_REVEAL } from '@/features/overview/hover-reveal';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { NoteThread } from '@/features/overview/note-thread';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { OwnerPicker } from '@/features/overview/owner-picker';
import {
  isStepEditable,
  isStepStructurallyFree,
} from '@/features/overview/step-mutability';
import { STEP_STATUS_LABELS } from '@/features/overview/step-status-labels';
import { useFocusOnOpen } from '@/features/overview/use-focus-on-open';
import { useStepNotes } from '@/features/overview/use-step-notes';
import { cn } from '@/lib/utils';

import type { Step, UserSummary, Workstream } from '@/api/hooks/use-overview';

interface StepEditorProperties {
  workstream: Workstream;
  step: Step;
  users: UserSummary[];
  projectId: string | undefined;
  now: Date;
  /** `null` closes the editor; another id moves it along the pipeline. */
  onOpenStep: (stepId: string | null) => void;
}

/**
 * The panel beneath a pipeline dot: everything about one Step, edited in place.
 * It owns its own mutations so a step being saved never freezes the rest of the
 * list, and every field commits on its own — there is no Save button.
 */
export const StepEditor = ({
  workstream,
  step,
  users,
  projectId,
  now,
  onOpenStep,
}: StepEditorProperties) => {
  const { t, i18n } = useTranslation();
  const panelRef = useFocusOnOpen<HTMLElement>();
  const updateStep = useUpdateStep(projectId);
  const deleteStep = useDeleteStep(projectId);
  const reorderSteps = useReorderSteps(projectId);

  const index = workstream.steps.findIndex((item) => item.id === step.id);
  const previous = workstream.steps[index - 1];
  const next = workstream.steps[index + 1];
  const isEditable = isStepEditable(step);
  const isCurrent = step.status === 'in_progress';
  const name = step.name || t('overview.pipeline.untitled');

  const futureIds = workstream.steps
    .filter((item) => isStepStructurallyFree(item))
    .map((item) => item.id);
  const canMoveEarlier =
    isStepStructurallyFree(step) &&
    Boolean(previous && isStepStructurallyFree(previous));
  const canMoveLater =
    isStepStructurallyFree(step) &&
    Boolean(next && isStepStructurallyFree(next));

  const patchStep = (body: {
    name?: string;
    deadline?: string | null;
    ownerId?: string | null;
    blocked?: boolean;
  }) => updateStep.mutate({ params: { path: { id: step.id } }, body });

  /** The endpoint takes the whole future tail, so a swap is sent as one order. */
  const moveBy = (offset: number) => {
    const from = futureIds.indexOf(step.id);
    const to = from + offset;
    if (from === -1 || to < 0 || to >= futureIds.length) return;

    const ids = futureIds.map((id, position) => {
      if (position === from) return futureIds[to]!;
      if (position === to) return futureIds[from]!;
      return id;
    });
    reorderSteps.mutate({
      params: { path: { id: workstream.id } },
      body: { ids },
    });
  };

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      aria-label={t('overview.stepEditor.panelLabel', { name })}
      className="rounded-lg border border-step-in-progress/40 bg-step-in-progress/5 p-2.5 outline-hidden focus-visible:ring-2 focus-visible:ring-step-in-progress/50"
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusDot step={step} />
        {isEditable ? (
          <ClickToEdit
            value={step.name}
            label={t('overview.stepEditor.nameLabel')}
            placeholder={t('overview.stepEditor.namePlaceholder')}
            className="min-w-0 flex-1 text-xs font-medium"
            startEditing={step.name === ''}
            onCommit={(value) => patchStep({ name: value })}
          />
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs font-medium">
            {name}
          </span>
        )}

        {isCurrent && (
          <span className="shrink-0 rounded bg-step-in-progress/12 px-1 py-0.5 text-[9px] font-semibold uppercase text-step-in-progress">
            {t('overview.stepEditor.current')}
          </span>
        )}
        {!isEditable && (
          <span className="shrink-0 text-[9px] font-semibold uppercase text-muted-foreground">
            {t(
              step.status === 'skipped'
                ? 'overview.stepStatus.skipped'
                : 'overview.stepStatus.done',
            )}
          </span>
        )}

        {isEditable ? (
          <DeadlineField
            value={step.deadline}
            label={t('overview.stepEditor.deadlineLabel')}
            now={now}
            onCommit={(deadline) => patchStep({ deadline })}
          />
        ) : (
          step.deadline && (
            <span className="shrink-0 px-1.5 text-[11px] tabular-nums text-muted-foreground">
              {t('overview.deadlineField.due', {
                date: formatDeadlineDate(step.deadline, now, i18n.language),
              })}
            </span>
          )
        )}

        {isEditable ? (
          <OwnerPicker
            users={users}
            ownerId={step.explicitOwnerId ?? step.effectiveOwnerId}
            label={t('overview.stepEditor.ownerLabel')}
            clearLabel={t('overview.stepEditor.inheritOwner')}
            onSelect={(ownerId) => patchStep({ ownerId })}
          />
        ) : (
          <OwnerAvatar
            owner={
              users.find(
                (user) =>
                  user.id === (step.explicitOwnerId ?? step.effectiveOwnerId),
              ) ?? null
            }
          />
        )}

        {/* Informational only: it never gates advancing (CONTEXT.md). */}
        {isCurrent && (
          <button
            type="button"
            aria-pressed={step.blocked}
            onClick={() => patchStep({ blocked: !step.blocked })}
            className={cn(
              'h-6 shrink-0 rounded-md px-1.5 text-[11px]',
              step.blocked
                ? 'bg-step-blocked/12 text-step-blocked'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {t(
              step.blocked
                ? 'overview.stepStatus.blocked'
                : 'overview.stepEditor.markBlocked',
            )}
          </button>
        )}
      </div>

      <ChecklistBlock
        step={step}
        isFrozen={!isEditable}
        projectId={projectId}
      />

      <NotesBlock
        workstreamId={workstream.id}
        step={step}
        projectId={projectId}
        now={now}
      />

      <div className="mt-2 flex items-center gap-1 border-t pt-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.stepEditor.previousStep')}
          title={t('overview.stepEditor.previousStep')}
          disabled={!previous}
          onClick={() => previous && onOpenStep(previous.id)}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.stepEditor.nextStep')}
          title={t('overview.stepEditor.nextStep')}
          disabled={!next}
          onClick={() => next && onOpenStep(next.id)}
        >
          <ChevronRightIcon />
        </Button>

        {/* Only the future tail reorders, so the buttons vanish on a current or
            past step rather than sitting there permanently disabled. */}
        {(canMoveEarlier || canMoveLater) && (
          <>
            <span aria-hidden className="mx-1 h-4 w-px bg-border" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('overview.stepEditor.moveEarlier', { name })}
              title={t('overview.stepEditor.moveEarlier', { name })}
              disabled={!canMoveEarlier}
              onClick={() => moveBy(-1)}
            >
              <ArrowLeftIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={t('overview.stepEditor.moveLater', { name })}
              title={t('overview.stepEditor.moveLater', { name })}
              disabled={!canMoveLater}
              onClick={() => moveBy(1)}
            >
              <ArrowRightIcon />
            </Button>
          </>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground">
          {t(
            isEditable
              ? 'overview.stepEditor.savedAsYouType'
              : 'overview.stepEditor.frozen',
          )}
        </span>

        {isStepStructurallyFree(step) && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={t('overview.stepEditor.deleteStep', { name })}
            title={t('overview.stepEditor.deleteStep', { name })}
            onClick={() =>
              deleteStep.mutate(
                { params: { path: { id: step.id } } },
                { onSuccess: () => onOpenStep(null) },
              )
            }
          >
            <Trash2Icon />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t('overview.stepEditor.close')}
          title={t('overview.stepEditor.close')}
          onClick={() => onOpenStep(null)}
        >
          <XIcon />
        </Button>
      </div>
    </section>
  );
};

// Softer sizes than the pipeline's dots: this one annotates the editor footer.
const FOOTER_DOT_CLASSES = {
  done: 'size-3 bg-step-done',
  in_progress: 'size-3.5 bg-step-in-progress',
  blocked: 'size-3.5 bg-step-blocked',
  not_started: 'size-3 border-[1.5px] border-step-not-started bg-card',
  skipped: 'size-3 border-[1.5px] border-dashed border-step-skipped bg-card',
} as const;

function StatusDot({ step }: { step: Step }) {
  const { t } = useTranslation();
  const visual = isBlockedNow(step) ? 'blocked' : step.status;

  return (
    <span
      role="img"
      aria-label={t(STEP_STATUS_LABELS[visual])}
      title={t(STEP_STATUS_LABELS[visual])}
      className={cn('shrink-0 rounded-full', FOOTER_DOT_CLASSES[visual])}
    />
  );
}

/**
 * The Step's sub-items in authored order. Progress here is informational — it
 * never gates advancing — and a frozen Step keeps the list as a record.
 */
function ChecklistBlock({
  step,
  isFrozen,
  projectId,
}: {
  step: Step;
  isFrozen: boolean;
  projectId: string | undefined;
}) {
  const { t } = useTranslation();
  const createItem = useCreateChecklistItem(projectId);
  const updateItem = useUpdateChecklistItem(projectId);
  const deleteItem = useDeleteChecklistItem(projectId);
  const [isComposing, setIsComposing] = useState(false);

  const items = step.checklistItems;
  const done = items.filter((item) => item.done).length;

  return (
    <div className="mt-1.5">
      {items.length > 0 && (
        <>
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecksIcon aria-hidden className="size-3" />
            {t('overview.stepEditor.checklistProgress', {
              done,
              total: items.length,
            })}
          </div>
          <ul className="mt-1 space-y-0.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="group/item flex items-center gap-1.5"
              >
                <button
                  type="button"
                  disabled={isFrozen}
                  aria-label={t('overview.pipeline.toggleItem', {
                    name: item.name,
                  })}
                  title={t('overview.pipeline.toggleItem', { name: item.name })}
                  aria-pressed={item.done}
                  onClick={() =>
                    updateItem.mutate({
                      params: { path: { id: item.id } },
                      body: { done: !item.done },
                    })
                  }
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                    item.done && 'border-step-done bg-step-done text-white',
                    isFrozen && 'cursor-default opacity-70',
                  )}
                >
                  {item.done && <CheckIcon aria-hidden className="size-2.5" />}
                </button>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px]',
                    item.done && 'text-muted-foreground line-through',
                  )}
                >
                  {item.name}
                </span>
                {!isFrozen && (
                  <button
                    type="button"
                    aria-label={t('overview.stepEditor.removeItem', {
                      name: item.name,
                    })}
                    title={t('overview.stepEditor.removeItem', {
                      name: item.name,
                    })}
                    onClick={() =>
                      deleteItem.mutate({ params: { path: { id: item.id } } })
                    }
                    className={cn(
                      HOVER_REVEAL,
                      'shrink-0 text-muted-foreground group-focus-within/item:opacity-100 group-hover/item:opacity-100',
                    )}
                  >
                    <XIcon aria-hidden className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {isFrozen ? null : isComposing ? (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
          autoFocus
          aria-label={t('overview.stepEditor.newItemLabel')}
          placeholder={t('overview.stepEditor.newItemPlaceholder')}
          className="mt-1 h-6 w-full rounded-md border bg-background px-1.5 text-[11px]"
          onBlur={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur();
            if (event.key !== 'Enter') return;

            const name = event.currentTarget.value.trim();
            if (!name) {
              event.currentTarget.blur();
              return;
            }

            createItem.mutate({
              params: { path: { stepId: step.id } },
              body: { name },
            });
            event.currentTarget.value = '';
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsComposing(true)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <PlusIcon aria-hidden className="size-3" />
          {t(
            items.length > 0
              ? 'overview.stepEditor.addItem'
              : 'overview.stepEditor.addChecklist',
          )}
        </button>
      )}
    </div>
  );
}

/**
 * A frozen Step still takes new notes — the one thing the pipeline rules keep
 * open on a past step — so this block never disappears with the rest of the
 * editing affordances.
 */
function NotesBlock({
  workstreamId,
  step,
  projectId,
  now,
}: {
  workstreamId: string;
  step: Step;
  projectId: string | undefined;
  now: Date;
}) {
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
}
