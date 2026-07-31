import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatDeadlineDate } from '@/features/overview/format-deadline-date';
import { cn } from '@/lib/utils';

interface DeadlineFieldProperties {
  value: string | null | undefined;
  /** Accessible name for both the trigger and the date input. */
  label: string;
  now: Date;
  className?: string;
  onCommit: (next: string | null) => void;
}

/**
 * A deadline that opens a native date input in place. The picker fires no
 * useful blur of its own, so the value commits on change; an unchanged pick
 * commits nothing.
 */
export const DeadlineField = ({
  value,
  label,
  now,
  className,
  onCommit,
}: DeadlineFieldProperties) => {
  const { t, i18n } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <input
        // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
        autoFocus
        type="date"
        aria-label={label}
        defaultValue={value ?? ''}
        className={cn(
          'h-6 rounded-md border bg-background px-1.5 text-[11px]',
          className,
        )}
        onChange={(event) => {
          const next = event.target.value || null;

          if (next !== (value ?? null)) onCommit(next);
        }}
        onBlur={() => setIsEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => setIsEditing(true)}
      className={cn(
        'h-6 shrink-0 cursor-pointer rounded-md px-1.5 text-[11px] tabular-nums hover:bg-muted',
        value ? 'text-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      {value
        ? t('overview.deadlineField.due', {
            date: formatDeadlineDate(value, now, i18n.language),
          })
        : t('overview.deadlineField.empty')}
    </button>
  );
};
