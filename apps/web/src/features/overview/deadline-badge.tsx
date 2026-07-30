import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';

const URGENCY_THRESHOLD_DAYS = 7;

interface DeadlineBadgeProperties {
  step: Step;
  today: Date;
}

export const DeadlineBadge = ({ step, today }: DeadlineBadgeProperties) => {
  const { t } = useTranslation();

  if (!step.deadline) return null;

  const days = daysUntil(step.deadline, today);
  const isOverdue = days < 0;
  const isSoon = !isOverdue && days < URGENCY_THRESHOLD_DAYS;

  const label = isOverdue
    ? t('overview.badge.overdue', { name: step.name, count: -days })
    : t('overview.badge.upcoming', { name: step.name, count: days });

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight tabular-nums',
        isOverdue && 'bg-urgency-late text-urgency-late-foreground',
        isSoon && 'bg-urgency-soon text-urgency-soon-foreground',
        !isOverdue && !isSoon && 'bg-urgency-calm text-urgency-calm-foreground',
      )}
    >
      {isSoon && <span aria-hidden>⚠</span>}
      {label}
    </span>
  );
};
