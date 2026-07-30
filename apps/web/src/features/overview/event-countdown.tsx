import { useTranslation } from 'react-i18next';

import { daysUntil } from '@/features/overview/days-until';

interface EventCountdownProperties {
  eventDate?: string | null;
}

/** Days to the event date; renders nothing when no event date is set. */
export const EventCountdown = ({ eventDate }: EventCountdownProperties) => {
  const { t } = useTranslation();

  if (eventDate === null || eventDate === undefined) {
    return null;
  }

  // eslint-disable-next-line @eslint-react/purity -- intentional clock read
  const now = new Date();
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
