import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useDeleteStep } from '@/api/hooks/use-delete-step';
import { useReorderSteps } from '@/api/hooks/use-reorder-steps';
import { useUpdateStep } from '@/api/hooks/use-update-step';
import { Button } from '@/components/ui/button';
import { ClickToEdit } from '@/features/overview/click-to-edit';
import { DeadlineField } from '@/features/overview/deadline-field';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { OwnerPicker } from '@/features/overview/owner-picker';
import { ChecklistBlock } from '@/features/overview/step-editor/checklist-block';
import { NotesBlock } from '@/features/overview/step-editor/notes-block';
import { StatusDot } from '@/features/overview/step-editor/status-dot';
import {
  isStepEditable,
  isStepStructurallyFree,
} from '@/features/overview/step-mutability';
import { useFocusOnOpen } from '@/features/overview/use-focus-on-open';
import { cn } from '@/lib/utils';

import type { Step, UserSummary, Workstream } from '@/api/hooks/use-overview';

interface StepEditorProperties {
  workstream: Workstream;
  step: Step;
  /** Joined members — the owner options. */
  users: UserSummary[];
  /** The users directory, for resolving owners who may no longer be members. */
  usersById: Map<string, UserSummary>;
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
  usersById,
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
            owner={resolveOwner(usersById, step)}
            label={t('overview.stepEditor.ownerLabel')}
            clearLabel={t('overview.stepEditor.inheritOwner')}
            onSelect={(ownerId) => patchStep({ ownerId })}
          />
        ) : (
          <OwnerAvatar owner={resolveOwner(usersById, step)} />
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

function resolveOwner(
  usersById: Map<string, UserSummary>,
  step: Step,
): UserSummary | null {
  const ownerId = step.explicitOwnerId ?? step.effectiveOwnerId;

  return ownerId ? (usersById.get(ownerId) ?? null) : null;
}
