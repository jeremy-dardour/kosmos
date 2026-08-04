import { daysUntil } from '@/features/overview/days-until';
import { monthKeyOf } from '@/features/overview/widgets/calendar-grid';

import type { DeadlineEntry } from '@/features/overview/widgets/collect-deadline-entries';

export interface DeadlineBuckets {
  overdue: DeadlineEntry[];
  /** Upcoming entries grouped by `YYYY-MM`, in ascending calendar order. */
  months: { key: string; entries: DeadlineEntry[] }[];
}

/**
 * Splits pending deadlines into overdue and month buckets — the shape the
 * agenda renders and the pulse reads its late/next facts from. Requires the
 * deadline-ascending order `collectDeadlineEntries` produces: month buckets
 * are built as contiguous runs, so an unsorted input would emit a month key
 * more than once.
 */
export function bucketDeadlineEntries(
  entries: DeadlineEntry[],
  now: Date,
): DeadlineBuckets {
  const overdue: DeadlineEntry[] = [];
  const months: DeadlineBuckets['months'] = [];

  for (const entry of entries) {
    if (daysUntil(entry.deadline, now) < 0) {
      overdue.push(entry);
      continue;
    }

    const key = monthKeyOf(entry.deadline);
    const last = months.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      months.push({ key, entries: [entry] });
    }
  }

  return { overdue, months };
}
