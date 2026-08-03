import { CheckIcon, ListChecksIcon, PlusIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateChecklistItem } from '@/api/hooks/use-create-checklist-item';
import { useDeleteChecklistItem } from '@/api/hooks/use-delete-checklist-item';
import { useUpdateChecklistItem } from '@/api/hooks/use-update-checklist-item';
import { HOVER_REVEAL } from '@/features/overview/hover-reveal';
import { cn } from '@/lib/utils';

import type { Step } from '@/api/hooks/use-overview';

interface ChecklistBlockProperties {
  step: Step;
  isFrozen: boolean;
  projectId: string | undefined;
}

/**
 * The Step's sub-items in authored order. Progress here is informational — it
 * never gates advancing — and a frozen Step keeps the list as a record.
 */
export const ChecklistBlock = ({
  step,
  isFrozen,
  projectId,
}: ChecklistBlockProperties) => {
  const { t } = useTranslation();
  const createItem = useCreateChecklistItem(projectId);
  const updateItem = useUpdateChecklistItem(projectId);
  const deleteItem = useDeleteChecklistItem(projectId);
  const [isComposing, setIsComposing] = useState(false);

  const items = step.checklistItems;
  const done = items.filter((item) => item.done).length;

  return (
    <div className="mt-1.5">
      {items.length > 0 && (
        <>
          <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecksIcon aria-hidden className="size-3" />
            {t('overview.stepEditor.checklistProgress', {
              done,
              total: items.length,
            })}
          </div>
          <ul className="mt-1 space-y-0.5">
            {items.map((item) => (
              <li
                key={item.id}
                className="group/item flex items-center gap-1.5"
              >
                <button
                  type="button"
                  disabled={isFrozen}
                  aria-label={t('overview.pipeline.toggleItem', {
                    name: item.name,
                  })}
                  title={t('overview.pipeline.toggleItem', { name: item.name })}
                  aria-pressed={item.done}
                  onClick={() =>
                    updateItem.mutate({
                      params: { path: { id: item.id } },
                      body: { done: !item.done },
                    })
                  }
                  className={cn(
                    'flex size-3.5 shrink-0 items-center justify-center rounded-[3px] border',
                    item.done && 'border-step-done bg-step-done text-white',
                    isFrozen && 'cursor-default opacity-70',
                  )}
                >
                  {item.done && <CheckIcon aria-hidden className="size-2.5" />}
                </button>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[11px]',
                    item.done && 'text-muted-foreground line-through',
                  )}
                >
                  {item.name}
                </span>
                {!isFrozen && (
                  <button
                    type="button"
                    aria-label={t('overview.stepEditor.removeItem', {
                      name: item.name,
                    })}
                    title={t('overview.stepEditor.removeItem', {
                      name: item.name,
                    })}
                    onClick={() =>
                      deleteItem.mutate({ params: { path: { id: item.id } } })
                    }
                    className={cn(
                      HOVER_REVEAL,
                      'shrink-0 text-muted-foreground group-focus-within/item:opacity-100 group-hover/item:opacity-100',
                    )}
                  >
                    <XIcon aria-hidden className="size-3" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {isFrozen ? null : isComposing ? (
        <input
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the click already moved focus here
          autoFocus
          aria-label={t('overview.stepEditor.newItemLabel')}
          placeholder={t('overview.stepEditor.newItemPlaceholder')}
          className="mt-1 h-6 w-full rounded-md border bg-background px-1.5 text-[11px]"
          onBlur={() => setIsComposing(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur();
            if (event.key !== 'Enter') return;

            const name = event.currentTarget.value.trim();
            if (!name) {
              event.currentTarget.blur();
              return;
            }

            createItem.mutate({
              params: { path: { stepId: step.id } },
              body: { name },
            });
            event.currentTarget.value = '';
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setIsComposing(true)}
          className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <PlusIcon aria-hidden className="size-3" />
          {t(
            items.length > 0
              ? 'overview.stepEditor.addItem'
              : 'overview.stepEditor.addChecklist',
          )}
        </button>
      )}
    </div>
  );
};
