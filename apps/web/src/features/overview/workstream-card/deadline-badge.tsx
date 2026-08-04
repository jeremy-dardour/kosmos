import { useTranslation } from 'react-i18next';

import { deadlineCountdown } from '@/features/overview/deadline-countdown';
import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';
import type { UrgencyBand } from '@/features/overview/urgency';

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

  const countdown = deadlineCountdown(step.deadline, now);
  const label = countdown
    ? t(countdown.key, { count: countdown.count })
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
