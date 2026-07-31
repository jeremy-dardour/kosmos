import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';
import { urgencyBand } from '@/features/overview/urgency';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';

interface DeadlineBadgeProperties {
  step: Step;
}

export const DeadlineBadge = ({ step }: DeadlineBadgeProperties) => {
  const { t } = useTranslation();

  if (!step.deadline) return null;

  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();
  const days = daysUntil(step.deadline, now);
  const band = urgencyBand(step.deadline, now);
  const isUrgent = band === 'passed' || band === 'week';

  const label =
    band === 'passed'
      ? t('overview.badge.overdue', { name: step.name, count: -days })
      : t('overview.badge.upcoming', { name: step.name, count: days });

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-tight tabular-nums',
        band === 'passed' && 'bg-urgency-late text-urgency-late-foreground',
        band === 'week' && 'bg-urgency-soon text-urgency-soon-foreground',
        !isUrgent && 'bg-urgency-calm text-urgency-calm-foreground',
      )}
    >
      {band === 'week' && <span aria-hidden>⚠</span>}
      {label}
    </span>
  );
};
