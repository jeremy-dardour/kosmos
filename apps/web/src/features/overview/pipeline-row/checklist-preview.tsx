import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ChecklistItem } from '@/api/hooks/use-overview';

interface ChecklistPreviewProperties {
  items: ChecklistItem[];
  isInteractive: boolean;
  onToggle: (itemId: string, isDone: boolean) => void;
}

/**
 * Ghosted checklist under a step dot: readable at a glance on the current and
 * next steps, tickable in place on the current one.
 */
export const ChecklistPreview = ({
  items,
  isInteractive,
  onToggle,
}: ChecklistPreviewProperties) => {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  // Only three items fit, so they should be the ones still needing doing —
  // a stable sort keeps the authored order within each half.
  const byRemaining = [...items].sort(
    (a, b) => Number(a.done) - Number(b.done),
  );
  const shown = byRemaining.slice(0, 3);
  const hidden = items.length - shown.length;

  return (
    <ul
      className={cn(
        'mx-auto mt-1.5 w-full max-w-44 space-y-0.5 px-1',
        isInteractive ? 'opacity-80' : 'pointer-events-none opacity-40',
      )}
    >
      {shown.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            disabled={!isInteractive}
            aria-label={t('overview.pipeline.toggleItem', { name: item.name })}
            title={t('overview.pipeline.toggleItem', { name: item.name })}
            aria-pressed={item.done}
            onClick={() => onToggle(item.id, !item.done)}
            className="flex w-full items-center gap-1 rounded px-0.5 text-left hover:bg-muted/60"
          >
            <span
              aria-hidden
              className={cn(
                'flex size-2.5 shrink-0 items-center justify-center rounded-[2px] border',
                item.done && 'border-step-done bg-step-done text-white',
              )}
            >
              {item.done && <CheckIcon className="size-2" />}
            </span>
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-[10px] leading-tight',
                item.done
                  ? 'text-muted-foreground line-through'
                  : 'text-foreground/80',
              )}
            >
              {item.name}
            </span>
          </button>
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-0.5 text-[10px] leading-tight text-muted-foreground/70">
          {t('overview.pipeline.moreItems', { count: hidden })}
        </li>
      )}
    </ul>
  );
};
