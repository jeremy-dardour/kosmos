import { describe, expect, it } from 'vitest';

import { deadlineCountdown } from '@/features/overview/deadline-countdown';

describe('deadlineCountdown', () => {
  const now = new Date(2026, 6, 25, 14, 30); // 2026-07-25, mid-afternoon

  it('words a past deadline as late with the overdue day count', () => {
    expect(deadlineCountdown('2026-07-24', now)).toEqual({
      key: 'overview.deadline.late',
      count: 1,
    });
    expect(deadlineCountdown('2026-07-18', now)).toEqual({
      key: 'overview.deadline.late',
      count: 7,
    });
  });

  it('words today and tomorrow without a count', () => {
    expect(deadlineCountdown('2026-07-25', now)).toEqual({
      key: 'overview.deadline.today',
    });
    expect(deadlineCountdown('2026-07-26', now)).toEqual({
      key: 'overview.deadline.tomorrow',
    });
  });

  it('words days two to thirteen as upcoming', () => {
    expect(deadlineCountdown('2026-07-27', now)).toEqual({
      key: 'overview.deadline.upcoming',
      count: 2,
    });
    expect(deadlineCountdown('2026-08-07', now)).toEqual({
      key: 'overview.deadline.upcoming',
      count: 13,
    });
  });

  it('returns null from the horizon day onward', () => {
    expect(deadlineCountdown('2026-08-08', now)).toBeNull(); // day 14
    expect(deadlineCountdown('2027-07-25', now)).toBeNull();
  });

  it('ignores the time of day on the boundary between late and today', () => {
    expect(
      deadlineCountdown('2026-07-25', new Date(2026, 6, 25, 23, 59)),
    ).toEqual({ key: 'overview.deadline.today' });
  });
});
