import { daysUntil } from '@/features/overview/days-until';

import type { Translations } from '@/types/i18n';

/** Under this horizon a deadline counts days; beyond it, a plain date reads better. */
export const COUNTDOWN_HORIZON_DAYS = 14;

export interface DeadlineCountdown {
  key: keyof Translations;
  count?: number;
}

/** The countdown wording for a deadline, or null when it sits beyond the horizon. */
export function deadlineCountdown(
  deadline: string,
  now: Date,
): DeadlineCountdown | null {
  const days = daysUntil(deadline, now);

  if (days < 0) return { key: 'overview.deadline.late', count: -days };
  if (days === 0) return { key: 'overview.deadline.today' };
  if (days === 1) return { key: 'overview.deadline.tomorrow' };
  if (days < COUNTDOWN_HORIZON_DAYS)
    return { key: 'overview.deadline.upcoming', count: days };

  return null;
}
