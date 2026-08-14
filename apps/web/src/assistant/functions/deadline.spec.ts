import { describe, expect, it } from 'vitest';

import { resolveDeadline } from '@/assistant/functions/deadline';

describe('resolveDeadline', () => {
  it('passes a calendar day through untouched', () => {
    expect(resolveDeadline('2026-09-12', '2026-10-03')).toEqual({
      ok: true,
      deadline: '2026-09-12',
    });
  });

  it('treats an absent deadline as none', () => {
    expect(resolveDeadline(undefined, '2026-10-03')).toEqual({
      ok: true,
      deadline: null,
    });
    expect(resolveDeadline(null, '2026-10-03')).toEqual({
      ok: true,
      deadline: null,
    });
  });

  it('counts daysBeforeEvent back from the event date', () => {
    expect(resolveDeadline({ daysBeforeEvent: 42 }, '2026-10-03')).toEqual({
      ok: true,
      deadline: '2026-08-22',
    });
  });

  it('counts across a month and a year boundary without drifting a day', () => {
    expect(resolveDeadline({ daysBeforeEvent: 1 }, '2027-01-01')).toEqual({
      ok: true,
      deadline: '2026-12-31',
    });
    expect(resolveDeadline({ daysBeforeEvent: 60 }, '2028-03-01')).toEqual({
      ok: true,
      deadline: '2028-01-01',
    });
  });

  it('tells the model to use an absolute date when the project has no event date', () => {
    const result = resolveDeadline({ daysBeforeEvent: 7 }, null);

    if (result.ok) throw new Error('expected the resolution to fail');
    expect(result.error).toContain('no event date');
    expect(result.error).toContain('YYYY-MM-DD');
  });

  it('rejects a non-integer day count', () => {
    expect(resolveDeadline({ daysBeforeEvent: 2.5 }, '2026-10-03').ok).toBe(
      false,
    );
  });

  it('rejects free text in place of a calendar day', () => {
    expect(resolveDeadline('next tuesday', '2026-10-03')).toEqual({
      ok: false,
      error:
        '"next tuesday" is not a calendar day. Use "YYYY-MM-DD" or {"daysBeforeEvent": n}.',
    });
  });
});
