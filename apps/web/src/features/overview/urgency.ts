import { daysUntil } from '@/features/overview/days-until';

export const URGENCY_THRESHOLD_DAYS = 7;

export type UrgencyBand = 'calm' | 'soon' | 'late';

export function urgencyBand(deadline: string, today: Date): UrgencyBand {
  const days = daysUntil(deadline, today);
  if (days < 0) return 'late';
  if (days < URGENCY_THRESHOLD_DAYS) return 'soon';
  return 'calm';
}
