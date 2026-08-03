import { describe, expect, it } from 'vitest';

import { urgencyBand } from '@/features/overview/urgency';

describe('urgencyBand', () => {
  const now = new Date(2026, 6, 25, 14, 30); // 2026-07-25, mid-afternoon

  it('classifies a past deadline as passed', () => {
    expect(urgencyBand('2026-07-24', now)).toBe('passed');
    expect(urgencyBand('2025-01-01', now)).toBe('passed');
  });

  it('classifies today and the next six days as week', () => {
    expect(urgencyBand('2026-07-25', now)).toBe('week');
    expect(urgencyBand('2026-07-31', now)).toBe('week'); // day 6
  });

  it('classifies days seven to thirteen as fortnight', () => {
    expect(urgencyBand('2026-08-01', now)).toBe('fortnight'); // day 7
    expect(urgencyBand('2026-08-07', now)).toBe('fortnight'); // day 13
  });

  it('classifies days fourteen to twenty-nine as month', () => {
    expect(urgencyBand('2026-08-08', now)).toBe('month'); // day 14
    expect(urgencyBand('2026-08-23', now)).toBe('month'); // day 29
  });

  it('classifies thirty days and beyond as far', () => {
    expect(urgencyBand('2026-08-24', now)).toBe('far'); // day 30
    expect(urgencyBand('2027-07-25', now)).toBe('far');
  });

  it('ignores the time of day on the boundary between passed and week', () => {
    expect(urgencyBand('2026-07-25', new Date(2026, 6, 25, 23, 59))).toBe(
      'week',
    );
  });

  it('bands across a year boundary by calendar days, not by year', () => {
    const lateDecember = new Date(2026, 11, 28, 9, 0);

    expect(urgencyBand('2027-01-02', lateDecember)).toBe('week'); // day 5
    expect(urgencyBand('2027-01-08', lateDecember)).toBe('fortnight'); // day 11
    expect(urgencyBand('2027-01-20', lateDecember)).toBe('month'); // day 23
    expect(urgencyBand('2027-01-27', lateDecember)).toBe('far'); // day 30
    expect(urgencyBand('2026-12-27', lateDecember)).toBe('passed');
  });
});
