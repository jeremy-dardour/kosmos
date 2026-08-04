import { AlertTriangleIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { deadlineCountdown } from '@/features/overview/deadline-countdown';
import { urgencyBand } from '@/features/overview/urgency';
import { URGENCY_TEXT_CLASSES } from '@/features/overview/widgets/urgency-text-classes';
import { cn } from '@/lib/utils';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

interface DeadlineRowProperties {
  entry: DeadlineEntry;
  now: Date;
  /** Absent in a host that has nothing to navigate to — the row goes inert. */
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

/**
 * One dated step in the agenda: its day number in the urgency colour, the step
 * and its workstream, and a countdown that stays silent beyond the horizon.
 */
export const DeadlineRow = ({
  entry,
  now,
  onEntryClick,
  onEntryHover,
}: DeadlineRowProperties) => {
  const { t } = useTranslation();

  const urgencyClass = URGENCY_TEXT_CLASSES[urgencyBand(entry.deadline, now)];
  const countdown = deadlineCountdown(entry.deadline, now);
  const layout =
    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left';

  const content = (
    <>
      <span
        className={cn(
          'w-7 shrink-0 text-center text-sm tabular-nums',
          urgencyClass,
        )}
      >
        {Number(entry.deadline.slice(8, 10))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">
            {entry.stepName || t('overview.widgets.untitledStep')}
          </span>
          {entry.blocked && (
            <>
              <AlertTriangleIcon
                aria-hidden
                className="size-3 shrink-0 text-urgency-passed"
              />
              <span className="sr-only">
                {t('overview.widgets.blockedStep')}
              </span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <span aria-hidden>{entry.workstreamIcon}</span>
          <span className="truncate">{entry.workstreamName}</span>
        </span>
      </span>
      {countdown && (
        <span className={cn('shrink-0 text-[11px] tabular-nums', urgencyClass)}>
          {t(countdown.key, { count: countdown.count })}
        </span>
      )}
    </>
  );

  if (!onEntryClick) {
    return <div className={layout}>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onEntryClick(entry)}
      onMouseEnter={() => onEntryHover?.(entry.workstreamId)}
      onMouseLeave={() => onEntryHover?.(null)}
      className={cn(layout, 'hover:bg-accent')}
    >
      {content}
    </button>
  );
};
