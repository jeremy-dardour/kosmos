import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ChecklistItem } from '@/api/hooks/use-overview';

interface ChecklistCardProperties {
  items: ChecklistItem[];
}

export const ChecklistCard = ({ items }: ChecklistCardProperties) => {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  const doneCount = items.filter((item) => item.done).length;

  return (
    <div className="rounded-md border bg-card/60 p-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t('overview.detail.checklist')}
        <span className="ml-1.5 tabular-nums">
          {t('overview.detail.checklistProgress', {
            done: doneCount,
            total: items.length,
          })}
        </span>
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <span
              className={cn(
                'inline-flex size-4 shrink-0 items-center justify-center rounded-sm border text-[10px]',
                item.done
                  ? 'border-step-done bg-step-done/12 text-step-done'
                  : 'border-muted-foreground/40',
              )}
              aria-hidden
            >
              {item.done ? '✓' : ''}
            </span>
            <span
              className={cn(item.done && 'text-muted-foreground line-through')}
            >
              {item.name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
