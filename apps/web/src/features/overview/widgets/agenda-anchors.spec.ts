import { describe, expect, it } from 'vitest';

import {
  agendaAnchorId,
  agendaSectionOf,
  OVERDUE_SECTION,
} from '@/features/overview/widgets/agenda-anchors';
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

describe('agendaSectionOf', () => {
  it('sends a date to its own month once that month has upcoming entries', () => {
    const buckets = bucket([
      ['mid-june', '2026-06-14'],
      ['late-june', '2026-06-29'],
      ['july', '2026-07-10'],
    ]);

    expect(agendaSectionOf(buckets, '2026-06-14')).toBe('2026-06');
    expect(agendaSectionOf(buckets, '2026-07-31')).toBe('2026-07');
  });

  it('sends a date whose month has no upcoming entries to the overdue section', () => {
    const buckets = bucket([
      ['early-may', '2026-05-01'],
      ['mid-june', '2026-06-14'],
    ]);

    expect(agendaSectionOf(buckets, '2026-05-01')).toBe(OVERDUE_SECTION);
    expect(agendaSectionOf(buckets, '2026-06-14')).toBe(OVERDUE_SECTION);
  });
});

describe('agendaAnchorId', () => {
  it('namespaces a section key to one panel', () => {
    expect(agendaAnchorId('panel-1', '2026-06')).toBe('panel-1-2026-06');
    expect(agendaAnchorId('panel-1', OVERDUE_SECTION)).toBe('panel-1-overdue');
  });
});
