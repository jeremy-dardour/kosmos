import { describe, expect, it } from 'vitest';

import { bucketDeadlineEntries } from '@/features/overview/widgets/deadline-buckets';
import { deadlineEntry } from '@/testing/deadline-entries';

/** Local midnight, so the spec never depends on the runner's timezone. */
const NOW = new Date(2026, 5, 15);

function bucket(deadlines: [string, string][]) {
  return bucketDeadlineEntries(
    deadlines.map(([stepId, deadline]) => deadlineEntry(deadline, { stepId })),
    NOW,
  );
}

describe('bucketDeadlineEntries', () => {
  it('treats today as upcoming and yesterday as overdue', () => {
    const buckets = bucket([
      ['yesterday', '2026-06-14'],
      ['today', '2026-06-15'],
      ['tomorrow', '2026-06-16'],
    ]);

    expect(buckets.overdue.map((entry) => entry.stepId)).toEqual(['yesterday']);
    expect(
      buckets.months.map(({ key, entries }) => [
        key,
        entries.map((entry) => entry.stepId),
      ]),
    ).toEqual([['2026-06', ['today', 'tomorrow']]]);
  });

  it('groups upcoming entries into contiguous month runs in calendar order', () => {
    const buckets = bucket([
      ['a', '2026-06-20'],
      ['b', '2026-06-28'],
      ['c', '2026-08-02'],
      ['d', '2026-08-30'],
      ['e', '2026-09-01'],
    ]);

    expect(
      buckets.months.map(({ key, entries }) => [
        key,
        entries.map((entry) => entry.stepId),
      ]),
    ).toEqual([
      ['2026-06', ['a', 'b']],
      ['2026-08', ['c', 'd']],
      ['2026-09', ['e']],
    ]);
  });

  it('keys months across year boundaries', () => {
    const buckets = bucket([
      ['last-year', '2025-11-04'],
      ['next-year', '2027-01-09'],
      ['also-next-year', '2027-01-25'],
      ['year-after', '2028-03-01'],
    ]);

    expect(buckets.overdue.map((entry) => entry.stepId)).toEqual(['last-year']);
    expect(
      buckets.months.map(({ key, entries }) => [
        key,
        entries.map((entry) => entry.stepId),
      ]),
    ).toEqual([
      ['2027-01', ['next-year', 'also-next-year']],
      ['2028-03', ['year-after']],
    ]);
  });

  it('splits a month straddling today between overdue and its month section', () => {
    const buckets = bucket([
      ['early-june', '2026-06-02'],
      ['mid-june', '2026-06-14'],
      ['late-june', '2026-06-15'],
      ['later-june', '2026-06-29'],
    ]);

    expect(buckets.overdue.map((entry) => entry.stepId)).toEqual([
      'early-june',
      'mid-june',
    ]);
    expect(
      buckets.months.map(({ key, entries }) => [
        key,
        entries.map((entry) => entry.stepId),
      ]),
    ).toEqual([['2026-06', ['late-june', 'later-june']]]);
  });

  it('produces no month sections when everything is overdue', () => {
    const buckets = bucket([
      ['a', '2026-05-01'],
      ['b', '2026-06-14'],
    ]);

    expect(buckets.overdue.map((entry) => entry.stepId)).toEqual(['a', 'b']);
    expect(buckets.months).toEqual([]);
  });

  it('returns both structures empty for an empty input', () => {
    expect(bucketDeadlineEntries([], NOW)).toEqual({ overdue: [], months: [] });
  });
});
