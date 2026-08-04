export interface MonthRef {
  year: number;
  /** 0-based, matching `Date.prototype.getMonth()`. */
  monthIndex: number;
}

export interface GridDay {
  day: number;
  /** ISO date-only. */
  iso: string;
  inMonth: boolean;
}

/**
 * Local calendar parts to an ISO date-only string. Never `toISOString()`,
 * which shifts the day west of UTC.
 */
export function isoOf(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, '0');
  const dayOfMonth = String(day).padStart(2, '0');

  return `${year}-${month}-${dayOfMonth}`;
}

/** The `'YYYY-MM'` bucket an ISO date-only value belongs to. */
export function monthKeyOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Monday-first month grid of whole weeks (4–6 rows). Leading and trailing
 * cells are the real neighbouring-month days, flagged `inMonth: false`.
 */
export function buildMonthGrid(month: MonthRef): GridDay[] {
  const { year, monthIndex } = month;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const rows = Math.ceil((offset + daysInMonth) / 7);

  const cells: GridDay[] = [];
  for (let index = 0; index < rows * 7; index++) {
    const date = new Date(year, monthIndex, 1 + (index - offset));
    cells.push({
      day: date.getDate(),
      iso: isoOf(date.getFullYear(), date.getMonth(), date.getDate()),
      inMonth: date.getMonth() === monthIndex,
    });
  }

  return cells;
}

/** Calendar-field arithmetic, so year rollover comes free in both directions. */
export function shiftMonth(month: MonthRef, delta: number): MonthRef {
  const shifted = new Date(month.year, month.monthIndex + delta, 1);

  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}
