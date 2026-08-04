import { describe, expect, it } from 'vitest';

import {
  agendaMonthLabel,
  monthNameOf,
  weekdayNames,
} from '@/features/overview/widgets/calendar-locale';

const NOW = new Date(2026, 7, 1);

describe('monthNameOf', () => {
  it('names a month from its 0-based index in the active locale', () => {
    expect(monthNameOf(0, 'en-GB')).toBe('January');
    expect(monthNameOf(8, 'fr')).toBe('septembre');
    expect(monthNameOf(11, 'es')).toBe('diciembre');
  });
});

describe('weekdayNames', () => {
  it('lists the seven weekdays starting on Monday', () => {
    expect(weekdayNames('en-GB')).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
  });

  it('starts on Monday whatever the locale conventions', () => {
    const names = weekdayNames('fr');

    expect(names).toHaveLength(7);
    expect(names[0]).toBe('lun.');
    expect(names[6]).toBe('dim.');
  });
});

describe('agendaMonthLabel', () => {
  it('omits the year within the current year', () => {
    expect(agendaMonthLabel('2026-09', NOW, 'en-GB')).toBe('September');
    expect(agendaMonthLabel('2026-01', NOW, 'fr')).toBe('janvier');
  });

  it('appends the year for another year', () => {
    expect(agendaMonthLabel('2027-03', NOW, 'en-GB')).toBe('March 2027');
    expect(agendaMonthLabel('2025-05', NOW, 'es')).toBe('mayo de 2025');
  });

  it('distinguishes the two sides of a year boundary', () => {
    expect(agendaMonthLabel('2026-12', NOW, 'en-GB')).toBe('December');
    expect(agendaMonthLabel('2027-01', NOW, 'en-GB')).toBe('January 2027');
  });
});
