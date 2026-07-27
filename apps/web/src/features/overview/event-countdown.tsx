import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';

interface EventCountdownProperties {
  eventDate?: string | null;
}

/** Re-renders after the local calendar day rolls over. */
function useCurrentDate(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    const timeout = globalThis.setTimeout(
      () => setNow(new Date()),
      nextMidnight.getTime() - now.getTime(),
    );

    return () => globalThis.clearTimeout(timeout);
  }, [now]);

  return now;
}

/** Days to the event date; renders nothing when no event date is set. */
export const EventCountdown = ({ eventDate }: EventCountdownProperties) => {
  const { t } = useTranslation();
  const now = useCurrentDate();

  if (eventDate === null || eventDate === undefined) {
    return null;
  }

  const daysUntilEvent = daysUntil(eventDate, now);
  const label =
    daysUntilEvent > 1
      ? t('overview.header.eventInDays', { count: daysUntilEvent })
      : daysUntilEvent === 1
        ? t('overview.header.eventTomorrow')
        : daysUntilEvent === 0
          ? t('overview.header.eventToday')
          : daysUntilEvent === -1
            ? t('overview.header.eventYesterday')
            : t('overview.header.eventPassed', { count: -daysUntilEvent });

  return (
    <span className="shrink-0 rounded-full bg-urgency-calm px-2.5 py-1 text-[11px] font-semibold tabular-nums text-urgency-calm-foreground">
      {label}
    </span>
  );
};
