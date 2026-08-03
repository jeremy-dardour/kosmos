import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { Group } from '@/api/hooks/use-overview';
import type { ReactNode } from 'react';

interface GroupHeaderProperties {
  group: Group | null;
  count: number;
  dragHandle?: ReactNode;
}

/** Shared with the Completed section, which clusters under the same headers. */
export const GroupHeader = ({
  group,
  count,
  dragHandle,
}: GroupHeaderProperties) => {
  const { t } = useTranslation();

  return (
    <header className="mb-2 flex items-center gap-2">
      {dragHandle}
      <span
        aria-hidden
        className={cn(
          'size-2 shrink-0 rounded-[2px]',
          !group && 'border border-muted-foreground/40',
        )}
        style={group ? { backgroundColor: group.color } : undefined}
      />
      <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {group?.name ?? t('overview.ungrouped')}
      </h2>
      <span className="text-[11px] tabular-nums text-muted-foreground/60">
        {count}
      </span>
    </header>
  );
};
