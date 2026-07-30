import { useTranslation } from 'react-i18next';

import { isBlockedNow } from '@/features/overview/is-blocked-now';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type { Step, StepStatus } from '@/api/hooks/use-overview';

type StepVisual = StepStatus | 'blocked';

interface PipelineDotsProperties {
  steps: Step[];
}

function stepVisual(step: Step): StepVisual {
  return isBlockedNow(step) ? 'blocked' : step.status;
}

const DOT_CLASSES: Record<StepVisual, string> = {
  done: 'size-dot bg-step-done',
  in_progress: 'size-dot-current bg-step-in-progress shadow-step-current',
  blocked: 'size-dot-current bg-step-blocked shadow-step-blocked',
  not_started: 'size-dot border-[1.5px] border-step-not-started bg-card',
  skipped: 'size-dot border-[1.5px] border-dashed border-step-skipped bg-card',
};

const STATUS_LABELS = {
  done: 'overview.stepStatus.done',
  in_progress: 'overview.stepStatus.inProgress',
  blocked: 'overview.stepStatus.blocked',
  not_started: 'overview.stepStatus.notStarted',
  skipped: 'overview.stepStatus.skipped',
} as const satisfies Record<StepVisual, string>;

function formatDateTick(deadline: string): string {
  const [, month, day] = deadline.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export const PipelineDots = ({ steps }: PipelineDotsProperties) => {
  const { t } = useTranslation();

  if (steps.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">
        {t('overview.card.noSteps')}
      </p>
    );
  }

  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();

  return (
    <ol className="flex items-start">
      {steps.map((step, index) => {
        const visual = stepVisual(step);
        const band = step.deadline
          ? urgencyBand(step.deadline, now)
          : undefined;
        const isUrgent = band === 'soon' || band === 'late';

        return (
          <li
            key={step.id}
            className="flex min-w-0 max-w-20 flex-1 flex-col items-center gap-1.5"
          >
            <div className="relative flex h-dot-current w-full items-center justify-center">
              {index > 0 && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-px w-1/2 -translate-y-1/2 bg-border"
                />
              )}
              {index < steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute right-0 top-1/2 h-px w-1/2 -translate-y-1/2 bg-border"
                />
              )}
              <span
                aria-hidden
                className={cn('relative rounded-full', DOT_CLASSES[visual])}
                title={`${step.name} — ${t(STATUS_LABELS[visual])}`}
              />
              <span className="sr-only">{t(STATUS_LABELS[visual])}</span>
            </div>
            <span
              className={cn(
                'w-full truncate px-0.5 text-center text-[10px] leading-tight',
                visual === 'in_progress' || visual === 'blocked'
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {step.name}
            </span>
            {step.deadline && (
              <span
                className={cn(
                  'text-[9px] tabular-nums leading-none',
                  isUrgent
                    ? 'font-medium text-urgency-late-foreground'
                    : 'text-muted-foreground',
                )}
              >
                {formatDateTick(step.deadline)}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
};
