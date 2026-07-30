import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';
import { DeadlineBadge } from '@/features/overview/deadline-badge';
import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { OwnerAvatar } from '@/features/overview/owner-avatar';
import { PipelineDots } from '@/features/overview/pipeline-dots';
import { WorkstreamCardAction } from '@/features/overview/workstream-card-action';
import { cn } from '@/lib/utils';

import type { AdvanceOutcome } from '@/api/hooks/use-advance-workstream';
import type { UserSummary, Workstream } from '@/api/hooks/use-overview';

interface WorkstreamCardProperties {
  workstream: Workstream;
  owner?: UserSummary | null;
  isSelected?: boolean;
  onSelect?: () => void;
  isAdvancing?: boolean;
  onAdvance?: (outcome?: AdvanceOutcome) => void;
  today: Date;
}

function findDeadlineStep(workstream: Workstream) {
  if (!workstream.nearestDeadlineStepId) return null;
  return (
    workstream.steps.find((s) => s.id === workstream.nearestDeadlineStepId) ??
    null
  );
}

function isOverdueWorkstream(workstream: Workstream, today: Date): boolean {
  const step = findDeadlineStep(workstream);
  if (!step?.deadline) return false;
  return daysUntil(step.deadline, today) < 0;
}

export const WorkstreamCard = ({
  workstream,
  owner,
  isSelected = false,
  onSelect,
  isAdvancing = false,
  onAdvance,
  today,
}: WorkstreamCardProperties) => {
  const { t } = useTranslation();

  const isComplete = workstream.lifecycle === 'complete';
  const isNotStarted = workstream.lifecycle === 'not_started';
  const isBlocked = workstream.steps.some((step) => isBlockedNow(step));
  const isOverdue = isOverdueWorkstream(workstream, today);
  const deadlineStep = findDeadlineStep(workstream);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('overview.card.openLabel', { name: workstream.name })}
        aria-pressed={isSelected}
        onClick={onSelect}
        className={cn(
          'w-full cursor-pointer rounded-lg border bg-card p-card pr-28 text-left shadow-xs transition-colors',
          isSelected
            ? 'border-step-in-progress bg-step-in-progress/8'
            : 'hover:border-muted-foreground/30',
          !isSelected && isBlocked && 'border-step-blocked/40',
          !isSelected && !isBlocked && isOverdue && 'border-step-blocked/40',
          isComplete && 'opacity-65',
        )}
      >
        <div className="flex items-center gap-2">
          <span aria-hidden className="text-base leading-none">
            {workstream.icon}
          </span>
          <h3 className="truncate text-sm font-semibold">{workstream.name}</h3>

          {isBlocked && (
            <span className="shrink-0 rounded-sm bg-step-blocked/12 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-step-blocked">
              {t('overview.stepStatus.blocked')}
            </span>
          )}
          {isNotStarted && (
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t('overview.card.notStarted')}
            </span>
          )}
          {isComplete && (
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-step-done">
              {t('overview.card.complete')}
            </span>
          )}

          {deadlineStep && <DeadlineBadge step={deadlineStep} today={today} />}

          <OwnerAvatar owner={owner} className="ml-auto" />
        </div>

        <div className="mt-3">
          <PipelineDots steps={workstream.steps} today={today} />
        </div>
      </button>

      {onAdvance && (
        <div className="absolute right-card top-card">
          <WorkstreamCardAction
            workstream={workstream}
            isPending={isAdvancing}
            onAdvance={onAdvance}
          />
        </div>
      )}
    </div>
  );
};
