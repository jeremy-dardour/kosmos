import type { JsonSchema } from '@/assistant/functions/function-parameters';

export type DeadlineResolution =
  | { ok: true; deadline: string | null }
  | { ok: false; error: string };

export const DEADLINE_SCHEMA: JsonSchema = {
  description:
    'Either a calendar day "YYYY-MM-DD", or {"daysBeforeEvent": n} to count back from the project event date. Omit for no deadline; pass null to clear one.',
  oneOf: [
    { type: 'string', description: 'A calendar day, "YYYY-MM-DD".' },
    {
      type: 'object',
      description: 'Counted back from the project event date.',
      properties: { daysBeforeEvent: { type: 'number' } },
      required: ['daysBeforeEvent'],
    },
  ],
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

const pad = (value: number): string => String(value).padStart(2, '0');

const toIsoDay = (utcMilliseconds: number): string => {
  const date = new Date(utcMilliseconds);
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-');
};

// UTC midnight throughout, so counting back a whole number of days can never
// cross a DST boundary and land on the previous calendar day.
const daysBefore = (isoDay: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = isoDay.split('-').map(Number);
  return toIsoDay(Date.UTC(year, month - 1, day) - days * MS_PER_DAY);
};

const NO_EVENT_DATE_ERROR =
  'This project has no event date, so {"daysBeforeEvent": n} cannot be resolved. Pass the deadline as an absolute "YYYY-MM-DD" calendar day instead.';

export function resolveDeadline(
  value: unknown,
  eventDate: string | null | undefined,
): DeadlineResolution {
  if (value === undefined || value === null)
    return { ok: true, deadline: null };

  if (typeof value === 'string') {
    return ISO_DAY.test(value)
      ? { ok: true, deadline: value }
      : {
          ok: false,
          error: `"${value}" is not a calendar day. Use "YYYY-MM-DD" or {"daysBeforeEvent": n}.`,
        };
  }

  if (typeof value === 'object' && 'daysBeforeEvent' in value) {
    const days = value.daysBeforeEvent;
    if (!Number.isSafeInteger(days)) {
      return {
        ok: false,
        error: '"daysBeforeEvent" must be a whole number of days.',
      };
    }
    if (!eventDate || !ISO_DAY.test(eventDate)) {
      return { ok: false, error: NO_EVENT_DATE_ERROR };
    }
    return { ok: true, deadline: daysBefore(eventDate, days as number) };
  }

  return {
    ok: false,
    error: 'A deadline must be "YYYY-MM-DD" or {"daysBeforeEvent": n}.',
  };
}
