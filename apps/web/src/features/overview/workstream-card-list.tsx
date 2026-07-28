import { useTranslation } from 'react-i18next';

import { GroupSection } from '@/features/overview/group-section';
import { groupWorkstreams } from '@/features/overview/group-workstreams';

import type { Group, UserSummary, Workstream } from '@/api/hooks/use-overview';

interface WorkstreamCardListProperties {
  groups: Group[];
  workstreams: Workstream[];
  usersById: ReadonlyMap<string, UserSummary>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export const WorkstreamCardList = ({
  groups,
  workstreams,
  usersById,
  selectedId,
  onSelect,
}: WorkstreamCardListProperties) => {
  const { t } = useTranslation();

  if (workstreams.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-panel text-center">
        <p className="text-sm font-medium">{t('overview.empty.title')}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('overview.empty.description')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groupWorkstreams(groups, workstreams).map((bucket) => (
        <GroupSection
          key={bucket.group?.id ?? 'ungrouped'}
          group={bucket.group}
          workstreams={bucket.workstreams}
          usersById={usersById}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
