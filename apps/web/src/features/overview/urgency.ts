import { daysUntil } from '@/features/overview/days-until';

export type UrgencyBand = 'passed' | 'week' | 'fortnight' | 'month' | 'far';

/**
 * The five-band deadline scale (handoff A6). Three bands were too coarse: a
 * step due tomorrow and one due in five months both read as "not late".
 */
export function urgencyBand(deadline: string, today: Date): UrgencyBand {
  const days = daysUntil(deadline, today);
  if (days < 0) return 'passed';
  if (days < 7) return 'week';
  if (days < 14) return 'fortnight';
  if (days < 30) return 'month';
  return 'far';
}
