import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';
import type { UrgencyBand } from '@/features/overview/urgency';

/** Under this horizon the badge counts days; beyond it, a plain date reads better. */
const COUNTDOWN_HORIZON_DAYS = 14;

const BAND_BADGE_CLASSES: Record<UrgencyBand, string> = {
  passed: 'bg-urgency-passed text-urgency-passed-foreground',
  week: 'bg-urgency-week text-urgency-week-foreground',
  fortnight: 'bg-urgency-fortnight text-urgency-fortnight-foreground',
  month: 'bg-urgency-month text-urgency-month-foreground',
  far: 'bg-muted text-muted-foreground',
};

interface DeadlineBadgeProperties {
  step: Step;
  now: Date;
}

export const DeadlineBadge = ({ step, now }: DeadlineBadgeProperties) => {
  const { t, i18n } = useTranslation();
  if (!step.deadline) return null;

  const days = daysUntil(step.deadline, now);
  const label =
    days < 0
      ? t('overview.deadline.late', { count: -days })
      : days === 0
        ? t('overview.deadline.today')
        : days === 1
          ? t('overview.deadline.tomorrow')
          : days < COUNTDOWN_HORIZON_DAYS
            ? t('overview.deadline.upcoming', { count: days })
            : formatDeadlineDate(step.deadline, now, i18n.language);

  return (
    <span
      title={t('overview.deadline.dueTooltip', {
        name: step.name,
        date: step.deadline,
      })}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] leading-tight',
        BAND_BADGE_CLASSES[urgencyBand(step.deadline, now)],
      )}
    >
      <span className="max-w-32 truncate opacity-80">{step.name}</span>
      <span className="font-semibold tabular-nums">{label}</span>
    </span>
  );
};
