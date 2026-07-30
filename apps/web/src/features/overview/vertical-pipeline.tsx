import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { StepChecklist } from '@/features/overview/step-checklist';
import { StepNotes } from '@/features/overview/step-notes';
import { cn } from '@/lib/utils';

import type {
  ChecklistItem,
  Step,
  StepStatus,
  UserSummary,
} from '@/api/hooks/use-overview';
import type { NoteEntry } from '@/api/hooks/use-workstream-notes';

interface VerticalPipelineProperties {
  steps: Step[];
  workstreamId?: string;
  usersById: ReadonlyMap<string, UserSummary>;
  notesByStepId?: ReadonlyMap<string, NoteEntry[]>;
  notesPending?: boolean;
  notesError?: boolean;
  pendingChecklistItemId?: string | null;
  onToggleChecklist?: (item: ChecklistItem, isDone: boolean) => void;
}

type StepVisual = StepStatus | 'blocked';

function stepVisual(step: Step): StepVisual {
  return isBlockedNow(step) ? 'blocked' : step.status;
}

const DOT_CLASSES: Record<StepVisual, string> = {
  done: 'size-2.5 bg-step-done',
  in_progress: 'size-3.5 bg-step-in-progress shadow-step-current',
  blocked: 'size-3.5 bg-step-blocked shadow-step-blocked',
  not_started: 'size-2.5 border-[1.5px] border-step-not-started bg-card',
  skipped: 'size-2.5 border-[1.5px] border-dashed border-step-skipped bg-card',
};

const BADGE_CLASSES: Partial<Record<StepVisual, string>> = {
  in_progress: 'bg-step-in-progress/12 text-step-in-progress',
  blocked: 'bg-step-blocked/12 text-step-blocked',
  skipped: 'bg-step-skipped/12 text-step-skipped',
};

const BADGE_LABELS = {
  in_progress: 'overview.detail.current',
  blocked: 'overview.stepStatus.blocked',
  skipped: 'overview.stepStatus.skipped',
} as const satisfies Partial<Record<StepVisual, string>>;

type Urgency = 'calm' | 'soon' | 'late';

function deadlineUrgency(days: number): Urgency {
  if (days <= 0) return 'late';
  if (days < 7) return 'soon';
  return 'calm';
}

const URGENCY_CLASSES = {
  calm: 'text-muted-foreground',
  soon: 'text-urgency-soon-foreground',
  late: 'text-urgency-late',
} as const;

export const VerticalPipeline = ({
  steps,
  workstreamId,
  usersById,
  notesByStepId,
  notesPending,
  notesError,
  pendingChecklistItemId,
  onToggleChecklist,
}: VerticalPipelineProperties) => {
  const { t } = useTranslation();

  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => {
        const visual = stepVisual(step);
        const badgeClass = BADGE_CLASSES[visual];
        const isDone = visual === 'done' || visual === 'skipped';
        const owner = step.effectiveOwnerId
          ? usersById.get(step.effectiveOwnerId)
          : null;

        return (
          <li key={step.id} className="relative flex gap-3">
            {/* Vertical connector line */}
            <div className="flex w-3.5 shrink-0 flex-col items-center">
              <span
                className={cn(
                  'relative z-10 shrink-0 rounded-full',
                  DOT_CLASSES[visual],
                )}
              />
              {index < steps.length - 1 && (
                <span className="w-px flex-1 bg-border" />
              )}
            </div>

            {/* Step content */}
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'truncate text-sm',
                    visual === 'in_progress' || visual === 'blocked'
                      ? 'font-semibold text-foreground'
                      : isDone
                        ? 'text-muted-foreground line-through'
                        : 'text-foreground',
                  )}
                >
                  {step.name}
                </span>

                {badgeClass && Object.hasOwn(BADGE_LABELS, visual) && (
                  <span
                    className={cn(
                      'shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      badgeClass,
                    )}
                  >
                    {t(BADGE_LABELS[visual as keyof typeof BADGE_LABELS])}
                  </span>
                )}

                {owner && (
                  <OwnerAvatar
                    owner={owner}
                    className="ml-auto size-5 text-[9px]"
                  />
                )}
              </div>

              {/* Outcome date for done/skipped steps */}
              {isDone && step.outcomeAt && (
                <span className="text-[11px] text-muted-foreground">
                  {new Date(step.outcomeAt).toLocaleDateString()}
                </span>
              )}

              {/* Deadline for future/current steps */}
              {!isDone && step.deadline && (
                <DeadlineLabel deadline={step.deadline} />
              )}

              <StepChecklist
                key={`${step.id}-${step.status}`}
                step={step}
                pendingItemId={pendingChecklistItemId}
                onToggle={onToggleChecklist}
              />
              {workstreamId && notesByStepId && (
                <StepNotes
                  workstreamId={workstreamId}
                  stepId={step.id}
                  stepName={step.name}
                  notes={notesByStepId.get(step.id) ?? []}
                  isPending={notesPending}
                  isError={notesError}
                />
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

function DeadlineLabel({ deadline }: { deadline: string }) {
  const { t } = useTranslation();
  const days = daysUntil(deadline);
  const urgency = deadlineUrgency(days);

  const relative =
    days < 0
      ? t('overview.detail.deadline.overdue', { count: -days })
      : days === 0
        ? t('overview.detail.deadline.today')
        : days === 1
          ? t('overview.detail.deadline.tomorrow')
          : t('overview.detail.deadline.in', { count: days });

  return (
    <span className={cn('text-[11px]', URGENCY_CLASSES[urgency])}>
      {deadline} · {relative}
    </span>
  );
}
