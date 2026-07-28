import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { ChecklistItem, Step } from '@/api/hooks/use-overview';

interface StepChecklistProperties {
  step: Step;
  pendingItemId?: string | null;
  onToggle?: (item: ChecklistItem, isDone: boolean) => void;
}

export const StepChecklist = ({
  step,
  pendingItemId,
  onToggle,
}: StepChecklistProperties) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(step.status === 'in_progress');

  if (step.checklistItems.length === 0) return null;

  const isPast = step.status === 'done' || step.status === 'skipped';
  const doneCount = step.checklistItems.filter((item) => item.done).length;

  return (
    <div
      className={cn(
        'mt-1.5 rounded-md border bg-muted/20 px-2 py-1.5',
        isPast && 'opacity-55',
      )}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-label={t(
          isExpanded
            ? 'overview.detail.hideChecklist'
            : 'overview.detail.showChecklist',
          { name: step.name },
        )}
        className="flex w-full items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        {isExpanded ? (
          <ChevronDownIcon className="size-3" />
        ) : (
          <ChevronRightIcon className="size-3" />
        )}
        <span>{t('overview.detail.checklist')}</span>
        <span className="tabular-nums">
          {t('overview.detail.checklistProgress', {
            done: doneCount,
            total: step.checklistItems.length,
          })}
        </span>
      </button>
      {isExpanded && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {step.checklistItems.map((item) => (
            <li key={item.id}>
              <label className="flex min-w-0 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  aria-label={item.name}
                  checked={item.done}
                  disabled={isPast || pendingItemId === item.id}
                  onChange={(event) => onToggle?.(item, event.target.checked)}
                  className="size-3.5 shrink-0 accent-step-done"
                />
                <span
                  className={cn(
                    'truncate',
                    item.done && 'text-muted-foreground line-through',
                  )}
                >
                  {item.name}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
