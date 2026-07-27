import { describe, expect, it } from 'vitest';

import { daysUntil } from '@/features/overview/days-until';

describe('daysUntil', () => {
  const now = new Date(2026, 6, 25, 14, 30); // 2026-07-25, mid-afternoon

  it('returns 0 for today regardless of the time of day', () => {
    expect(daysUntil('2026-07-25', now)).toBe(0);
    expect(daysUntil('2026-07-25', new Date(2026, 6, 25, 23, 59))).toBe(0);
  });

  it('counts whole days forward', () => {
    expect(daysUntil('2026-07-26', now)).toBe(1);
    expect(daysUntil('2026-08-01', now)).toBe(7);
  });

  it('returns a negative count for past dates', () => {
    expect(daysUntil('2026-07-24', now)).toBe(-1);
    expect(daysUntil('2026-07-18', now)).toBe(-7);
  });

  it('spans month and year boundaries', () => {
    expect(daysUntil('2026-08-01', new Date(2026, 6, 31))).toBe(1);
    expect(daysUntil('2027-01-01', new Date(2026, 11, 31))).toBe(1);
  });

  it('handles a leap day', () => {
    expect(daysUntil('2028-03-01', new Date(2028, 1, 28))).toBe(2);
  });
});
