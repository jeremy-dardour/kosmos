import { useTranslation } from 'react-i18next';

import { WorkstreamCard } from '@/features/overview/workstream-card';

import type { UserSummary } from '@/api/hooks/use-overview';
import type { WorkstreamGroup } from '@/features/overview/group-workstreams';

interface GroupSectionProperties extends WorkstreamGroup {
  usersById: ReadonlyMap<string, UserSummary>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const GroupSection = ({
  group,
  workstreams,
  usersById,
  selectedId,
  onSelect,
}: GroupSectionProperties) => {
  const { t } = useTranslation();

  const label = group?.name ?? t('overview.ungrouped');

  return (
    <section aria-label={label}>
      <header className="mb-2 flex items-center gap-2">
        {group ? (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: group.color }}
          />
        ) : (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px] border border-muted-foreground/40"
          />
        )}
        <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        <span className="text-[11px] tabular-nums text-muted-foreground/60">
          {workstreams.length}
        </span>
      </header>

      <div className="flex flex-col gap-2.5">
        {workstreams.map((workstream) => (
          <WorkstreamCard
            key={workstream.id}
            workstream={workstream}
            owner={
              workstream.ownerId
                ? (usersById.get(workstream.ownerId) ?? null)
                : null
            }
            isSelected={workstream.id === selectedId}
            onSelect={() => onSelect(workstream.id)}
          />
        ))}
      </div>
    </section>
  );
};
