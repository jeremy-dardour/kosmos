import { describe, expect, it } from 'vitest';

import {
  buildMonthGrid,
  isoOf,
  monthKeyOf,
  shiftMonth,
} from '@/features/overview/widgets/calendar-grid';

import type { GridDay } from '@/features/overview/widgets/calendar-grid';

function isoOfMonth(cells: GridDay[]): string[] {
  return cells.filter((cell) => cell.inMonth).map((cell) => cell.iso);
}

function isoOutsideMonth(cells: GridDay[]): string[] {
  return cells.filter((cell) => !cell.inMonth).map((cell) => cell.iso);
}

describe('buildMonthGrid', () => {
  it('pads a Sunday-first month back to the preceding Monday and out to six rows', () => {
    const cells = buildMonthGrid({ year: 2026, monthIndex: 2 });

    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ day: 23, iso: '2026-02-23', inMonth: false });
    expect(cells[6]).toEqual({ day: 1, iso: '2026-03-01', inMonth: true });
    expect(cells.at(-1)).toEqual({ day: 5, iso: '2026-04-05', inMonth: false });
  });

  it('emits exactly four rows for a 28-day month that starts on a Monday', () => {
    const cells = buildMonthGrid({ year: 2027, monthIndex: 1 });

    expect(cells).toHaveLength(28);
    expect(isoOutsideMonth(cells)).toEqual([]);
    expect(cells[0]).toEqual({ day: 1, iso: '2027-02-01', inMonth: true });
    expect(cells.at(-1)).toEqual({ day: 28, iso: '2027-02-28', inMonth: true });
  });

  it('emits five rows for a month that neither starts nor ends on a week edge', () => {
    const cells = buildMonthGrid({ year: 2026, monthIndex: 1 });

    expect(cells).toHaveLength(35);
    expect(isoOutsideMonth(cells)).toEqual([
      '2026-01-26',
      '2026-01-27',
      '2026-01-28',
      '2026-01-29',
      '2026-01-30',
      '2026-01-31',
      '2026-03-01',
    ]);
  });

  it('includes February 29th in a leap year', () => {
    const inMonth = isoOfMonth(buildMonthGrid({ year: 2024, monthIndex: 1 }));

    expect(inMonth).toHaveLength(29);
    expect(inMonth.at(-1)).toBe('2024-02-29');
  });

  it('stops February at the 28th in a non-leap year', () => {
    const inMonth = isoOfMonth(buildMonthGrid({ year: 2026, monthIndex: 1 }));

    expect(inMonth).toHaveLength(28);
    expect(inMonth.at(-1)).toBe('2026-02-28');
  });

  it('walks into the previous year for leading days of January', () => {
    const cells = buildMonthGrid({ year: 2026, monthIndex: 0 });

    expect(isoOutsideMonth(cells)).toEqual([
      '2025-12-29',
      '2025-12-30',
      '2025-12-31',
      '2026-02-01',
    ]);
  });

  it('walks into the next year for trailing days of December', () => {
    const cells = buildMonthGrid({ year: 2025, monthIndex: 11 });

    expect(cells[0]).toEqual({ day: 1, iso: '2025-12-01', inMonth: true });
    expect(isoOutsideMonth(cells)).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
    ]);
  });

  it('covers every day of the month once, in order, across a whole year', () => {
    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const cells = buildMonthGrid({ year: 2026, monthIndex });
      const daysInMonth = new Date(2026, monthIndex + 1, 0).getDate();

      expect(cells.length % 7).toBe(0);
      expect(cells.length / 7).toBeGreaterThanOrEqual(4);
      expect(cells.length / 7).toBeLessThanOrEqual(6);
      expect(isoOfMonth(cells)).toEqual(
        Array.from({ length: daysInMonth }, (_, index) =>
          isoOf(2026, monthIndex, index + 1),
        ),
      );
    }
  });
});

describe('isoOf', () => {
  it('zero-pads a single-digit month and day', () => {
    expect(isoOf(2026, 0, 5)).toBe('2026-01-05');
  });

  it('leaves two-digit parts untouched', () => {
    expect(isoOf(2026, 11, 25)).toBe('2026-12-25');
  });
});

describe('monthKeyOf', () => {
  it('keeps the year and month of an ISO date', () => {
    expect(monthKeyOf('2026-03-09')).toBe('2026-03');
  });
});

describe('shiftMonth', () => {
  it('rolls forward into the next year', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 11 }, 1)).toEqual({
      year: 2027,
      monthIndex: 0,
    });
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 0 }, -1)).toEqual({
      year: 2025,
      monthIndex: 11,
    });
  });

  it('handles a delta beyond a full year in both directions', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 5 }, 20)).toEqual({
      year: 2028,
      monthIndex: 1,
    });
    expect(shiftMonth({ year: 2026, monthIndex: 5 }, -20)).toEqual({
      year: 2024,
      monthIndex: 9,
    });
  });

  it('returns the same month for a zero delta', () => {
    expect(shiftMonth({ year: 2026, monthIndex: 7 }, 0)).toEqual({
      year: 2026,
      monthIndex: 7,
    });
  });
});
