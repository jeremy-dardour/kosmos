import { monthKeyOf } from '@/features/overview/widgets/calendar-grid';

import type { DeadlineBuckets } from '@/features/overview/widgets/deadline-buckets';

export const OVERDUE_SECTION = 'overdue';

/** The element id an agenda section renders, namespaced to one panel. */
export function agendaAnchorId(prefix: string, sectionKey: string): string {
  return `${prefix}-${sectionKey}`;
}

/** The section an ISO date lands in: a month with upcoming entries, or overdue. */
export function agendaSectionOf(buckets: DeadlineBuckets, iso: string): string {
  const key = monthKeyOf(iso);

  return buckets.months.some((month) => month.key === key)
    ? key
    : OVERDUE_SECTION;
}
