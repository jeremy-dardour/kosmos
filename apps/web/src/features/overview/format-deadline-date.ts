/**
 * `2026-09-12` → `12 Sept`, keeping a 2-digit year whenever it is not the
 * current one: without it a deadline from last year reads as a future date.
 */
export function formatDeadlineDate(
  isoDate: string,
  now: Date,
  locale?: string,
): string {
  const [year, month, day] = isoDate.split('-');
  const target = new Date(Number(year), Number(month) - 1, Number(day));

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(Number(year) !== now.getFullYear() && { year: '2-digit' }),
  }).format(target);
}
