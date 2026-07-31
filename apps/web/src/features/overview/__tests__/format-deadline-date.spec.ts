import { describe, expect, it } from 'vitest';

import { formatDeadlineDate } from '@/features/overview/format-deadline-date';

const NOW = new Date(2026, 7, 1);

describe('formatDeadlineDate', () => {
  it('omits the year for a deadline in the current year', () => {
    expect(formatDeadlineDate('2026-09-12', NOW, 'en-GB')).toBe('12 Sept');
  });

  it('keeps a 2-digit year for a deadline in another year', () => {
    expect(formatDeadlineDate('2025-10-01', NOW, 'en-GB')).toBe('1 Oct 25');
    expect(formatDeadlineDate('2027-10-01', NOW, 'en-GB')).toBe('1 Oct 27');
  });

  it('follows the active locale ordering and month names', () => {
    expect(formatDeadlineDate('2026-09-12', NOW, 'fr')).toBe('12 sept.');
    expect(formatDeadlineDate('2025-10-01', NOW, 'en-US')).toBe('Oct 1, 25');
  });

  it('reads the date as a local calendar day', () => {
    expect(formatDeadlineDate('2025-01-01', NOW, 'en-GB')).toBe('1 Jan 25');
  });
});
