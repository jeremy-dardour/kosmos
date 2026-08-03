import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { GroupHeader } from '@/features/overview/group-header';
import { groupWorkstreams } from '@/features/overview/group-workstreams';
import { cn } from '@/lib/utils';

import type { Group, Workstream } from '@/api/hooks/use-overview';
import type { ReactNode } from 'react';

interface CompletedSectionProperties {
  groups: Group[];
  /** The Complete workstreams; the section hides itself when there are none. */
  workstreams: Workstream[];
  children: (workstream: Workstream) => ReactNode;
}

/**
 * Done work leaves its group and sinks here, collapsed by default — the page
 * ends where live work ends, and the count alone carries the progress feel.
 * Inside, cards cluster by group in the live list's group order and keep the
 * recessive complete-card treatment: openable, never draggable.
 */
export const CompletedSection = ({
  groups,
  workstreams,
  children,
}: CompletedSectionProperties) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (workstreams.length === 0) return null;

  return (
    <section aria-label={t('overview.completed.title')}>
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex w-full items-center gap-2 rounded py-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronRightIcon
          aria-hidden
          className={cn(
            'size-3.5 shrink-0 transition-transform',
            isOpen && 'rotate-90',
          )}
        />
        <CheckIcon aria-hidden className="size-3.5 shrink-0 text-step-done" />
        <span className="text-[11px] font-medium uppercase tracking-wider">
          {t('overview.completed.title')}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {workstreams.length}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </button>

      {isOpen && (
        <div className="mt-3 flex flex-col gap-4">
          {groupWorkstreams(groups, workstreams).map((bucket) => (
            <div key={bucket.group?.id ?? 'ungrouped'}>
              <GroupHeader
                group={bucket.group}
                count={bucket.workstreams.length}
              />
              <div className="flex flex-col gap-2.5">
                {bucket.workstreams.map((workstream) => children(workstream))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
