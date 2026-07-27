const MILLISECONDS_PER_DAY = 86_400_000;

/** Whole local-calendar days from now to an ISO date-only value. */
export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const [year, month, day] = isoDate.split('-');
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / MILLISECONDS_PER_DAY);
}
