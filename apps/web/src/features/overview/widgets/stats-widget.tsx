import { AlertTriangleIcon, CalendarDaysIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DeadlineRow } from '@/features/overview/widgets/deadline-row';
import { cn } from '@/lib/utils';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';
import type { PulseStats } from '@/features/overview/widgets/project-pulse-stats';

interface StatsWidgetProperties {
  stats: PulseStats;
  now: Date;
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

/**
 * The Project pulse body: overall progress, the workstream head-count split,
 * what needs attention and the next thing due. Every number arrives derived —
 * the widget only lays them out.
 */
export const StatsWidget = ({
  stats,
  now,
  onEntryClick,
  onEntryHover,
}: StatsWidgetProperties) => {
  const { t } = useTranslation();

  const tiles = [
    { labelKey: 'overview.widgets.pulse.total', value: stats.total },
    { labelKey: 'overview.widgets.pulse.active', value: stats.active },
    { labelKey: 'overview.widgets.pulse.queued', value: stats.queued },
    { labelKey: 'overview.widgets.pulse.done', value: stats.done },
  ] as const;

  const chips = [
    {
      labelKey: 'overview.widgets.pulse.blocked',
      icon: AlertTriangleIcon,
      count: stats.blockedWorkstreams,
    },
    {
      labelKey: 'overview.widgets.pulse.overdue',
      icon: CalendarDaysIcon,
      count: stats.overdueCount,
    },
  ] as const;

  const progressLabel = t('overview.widgets.pulse.progress', {
    percent: stats.progressPct,
  });

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div
          role="progressbar"
          aria-label={progressLabel}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={stats.progressPct}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-step-done transition-[width]"
            style={{ width: `${stats.progressPct}%` }}
          />
        </div>
        <p aria-hidden className="mt-1 text-[11px] text-muted-foreground">
          {progressLabel}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {tiles.map(({ labelKey, value }) => (
          <div
            key={labelKey}
            className="rounded-md border bg-card px-2.5 py-1.5"
          >
            <div className="text-lg font-semibold tabular-nums">{value}</div>
            <div className="text-[11px] text-muted-foreground">
              {t(labelKey)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {chips.map(({ labelKey, icon: Icon, count }) => (
          <div
            key={labelKey}
            className={cn(
              'flex flex-1 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px]',
              count > 0
                ? 'border-urgency-passed/40 text-urgency-passed'
                : 'text-muted-foreground',
            )}
          >
            <Icon aria-hidden className="size-3.5 shrink-0" />
            <span className="font-semibold tabular-nums">{count}</span>
            <span>{t(labelKey)}</span>
          </div>
        ))}
      </div>

      {stats.nextEntry && (
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('overview.widgets.pulse.nextDeadline')}
          </p>
          <div className="rounded-md border">
            <DeadlineRow
              entry={stats.nextEntry}
              now={now}
              onEntryClick={onEntryClick}
              onEntryHover={onEntryHover}
            />
          </div>
        </div>
      )}
    </div>
  );
};
