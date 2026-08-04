import { useTranslation } from 'react-i18next';

import {
  agendaAnchorId,
  OVERDUE_SECTION,
} from '@/features/overview/widgets/agenda-anchors';
import { agendaMonthLabel } from '@/features/overview/widgets/calendar-locale';
import { DeadlineRow } from '@/features/overview/widgets/deadline-row';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';
import type { DeadlineBuckets } from '@/features/overview/widgets/deadline-buckets';

interface AgendaWidgetProperties {
  buckets: DeadlineBuckets;
  now: Date;
  /** Namespaces the section ids the calendar grid scrolls to. */
  anchorPrefix: string;
  onEntryClick?: (entry: DeadlineEntry) => void;
  onEntryHover?: (workstreamId: string | null) => void;
}

/**
 * The dated deadlines as a running list: what is already late, then a section
 * per month.
 */
export const AgendaWidget = ({
  buckets,
  now,
  anchorPrefix,
  onEntryClick,
  onEntryHover,
}: AgendaWidgetProperties) => {
  const { t, i18n } = useTranslation();

  if (buckets.overdue.length === 0 && buckets.months.length === 0) {
    return (
      <p className="px-2 py-4 text-center text-xs text-muted-foreground">
        {t('overview.widgets.agenda.empty')}
      </p>
    );
  }

  const rowsOf = (entries: DeadlineEntry[]) =>
    entries.map((entry) => (
      <DeadlineRow
        key={entry.stepId}
        entry={entry}
        now={now}
        onEntryClick={onEntryClick}
        onEntryHover={onEntryHover}
      />
    ));

  return (
    <div className="flex flex-col gap-3">
      {buckets.overdue.length > 0 && (
        <div id={agendaAnchorId(anchorPrefix, OVERDUE_SECTION)}>
          <div className="mb-1 flex items-baseline px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-urgency-passed">
              {t('overview.widgets.agenda.overdue')}
            </span>
          </div>
          <div className="flex flex-col">{rowsOf(buckets.overdue)}</div>
        </div>
      )}

      {buckets.months.map(({ key, entries }) => (
        <div key={key} id={agendaAnchorId(anchorPrefix, key)}>
          <div className="mb-1 flex items-baseline justify-between px-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {agendaMonthLabel(key, now, i18n.language)}
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground/70">
              {entries.length}
            </span>
          </div>
          <div className="flex flex-col">{rowsOf(entries)}</div>
        </div>
      ))}
    </div>
  );
};
