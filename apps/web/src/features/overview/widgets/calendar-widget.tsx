import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { urgencyBand } from '@/features/overview/urgency';
import { URGENCY_DOT_CLASSES } from '@/features/overview/urgency-classes';
import {
  buildMonthGrid,
  isoOf,
  shiftMonth,
} from '@/features/overview/widgets/calendar-grid';
import {
  monthNameOf,
  weekdayNames,
} from '@/features/overview/widgets/calendar-locale';
import { cn } from '@/lib/utils';

import type { MonthRef } from '@/features/overview/widgets/calendar-grid';
import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

const MAX_DOTS = 3;

interface CalendarWidgetProperties {
  /** Keyed by the raw `deadline` of the entries it holds. */
  entriesByDate: ReadonlyMap<string, DeadlineEntry[]>;
  now: Date;
  /** Absent in a host with nothing to open — the whole grid goes inert. */
  onSelectDay?: (iso: string) => void;
}

/**
 * A month at a glance: every day carrying deadlines is marked with up to three
 * urgency dots. Navigation is unbounded and local — the viewed month is a
 * glance, not a selection worth persisting.
 */
export const CalendarWidget = ({
  entriesByDate,
  now,
  onSelectDay,
}: CalendarWidgetProperties) => {
  const { t, i18n } = useTranslation();

  const [view, setView] = useState<MonthRef>(() => ({
    year: now.getFullYear(),
    monthIndex: now.getMonth(),
  }));

  const cells = buildMonthGrid(view);
  const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
  const markedCount = cells.filter(
    (cell) => cell.inMonth && entriesByDate.has(cell.iso),
  ).length;

  const shift = (delta: number) => {
    setView((previous) => shiftMonth(previous, delta));
  };

  const navClass =
    'rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground';

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <button
          type="button"
          aria-label={t('overview.widgets.calendar.previousMonth')}
          onClick={() => shift(-1)}
          className={navClass}
        >
          <ChevronLeftIcon aria-hidden className="size-3.5" />
        </button>
        <div className="text-xs font-semibold capitalize">
          {monthNameOf(view.monthIndex, i18n.language)} {view.year}
        </div>
        <button
          type="button"
          aria-label={t('overview.widgets.calendar.nextMonth')}
          onClick={() => shift(1)}
          className={navClass}
        >
          <ChevronRightIcon aria-hidden className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center">
        {weekdayNames(i18n.language).map((weekday) => (
          <div
            key={weekday}
            className="pb-1 text-[10px] font-medium text-muted-foreground/70"
          >
            {weekday}
          </div>
        ))}

        {cells.map((cell) => {
          const entries = entriesByDate.get(cell.iso) ?? [];
          const isMarked = cell.inMonth && entries.length > 0;
          const isToday = cell.inMonth && cell.iso === todayIso;

          const cellClass = cn(
            'mx-auto flex size-9 flex-col items-center rounded-md pt-1',
            cell.inMonth ? 'text-muted-foreground' : 'text-muted-foreground/40',
            isMarked && 'text-foreground',
          );

          const content = (
            <>
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums',
                  isMarked && 'font-semibold',
                  isToday &&
                    'bg-step-in-progress font-semibold text-background',
                )}
              >
                {cell.day}
              </span>
              {isMarked && (
                <span aria-hidden className="mt-0.5 flex gap-0.5">
                  {entries.slice(0, MAX_DOTS).map((entry) => (
                    <span
                      key={entry.stepId}
                      className={cn(
                        'size-1.5 rounded-full',
                        URGENCY_DOT_CLASSES[urgencyBand(entry.deadline, now)],
                      )}
                    />
                  ))}
                </span>
              )}
            </>
          );

          if (!isMarked) {
            return (
              <div key={cell.iso} className={cellClass}>
                {content}
              </div>
            );
          }

          const title = entries
            .map((entry) => `${entry.workstreamIcon} ${entry.stepName}`)
            .join('\n');

          if (!onSelectDay) {
            return (
              <div key={cell.iso} title={title} className={cellClass}>
                {content}
              </div>
            );
          }

          return (
            <button
              key={cell.iso}
              type="button"
              title={title}
              aria-label={`${formatDeadlineDate(cell.iso, now, i18n.language)}, ${t(
                'overview.widgets.calendar.dayDeadlines',
                { count: entries.length },
              )}`}
              onClick={() => onSelectDay(cell.iso)}
              className={cn(cellClass, 'hover:bg-accent')}
            >
              {content}
            </button>
          );
        })}
      </div>

      <p className="mt-1 px-1 text-right text-[10px] text-muted-foreground/70">
        {t('overview.widgets.calendar.markedDays', { count: markedCount })}
      </p>
    </div>
  );
};
