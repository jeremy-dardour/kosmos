/**
 * The calendar grid always starts its week on Monday, so the weekday header is
 * read off a known Monday rather than from the locale's own week info.
 * 2024-01-01 happens to be one — the year itself carries no meaning.
 */
const REFERENCE_MONDAY = new Date(2024, 0, 1);

/** Month names do not vary by year; any fixed year serves the lookup. */
const REFERENCE_YEAR = 2024;

export function monthNameOf(monthIndex: number, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(REFERENCE_YEAR, monthIndex, 1),
  );
}

export function weekdayNames(locale?: string): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  return Array.from({ length: 7 }, (_, offset) =>
    format.format(
      new Date(
        REFERENCE_MONDAY.getFullYear(),
        REFERENCE_MONDAY.getMonth(),
        REFERENCE_MONDAY.getDate() + offset,
      ),
    ),
  );
}

/**
 * `2026-09` → `September`, appending the year whenever it is not the current
 * one: without it an agenda section spanning a year boundary is ambiguous.
 */
export function agendaMonthLabel(
  monthKey: string,
  now: Date,
  locale?: string,
): string {
  const [year, month] = monthKey.split('-');
  const target = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    ...(Number(year) !== now.getFullYear() && { year: 'numeric' }),
  }).format(target);
}
